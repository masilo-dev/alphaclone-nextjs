-- Canonical, tenant-scoped social publication operation ledger.
-- This migration is additive; legacy social_posts fields remain readable during rollout.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS original_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS final_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS thumbnail_asset_id uuid NULL REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preview_asset_id uuid NULL REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS probe_verified_at timestamptz NULL;

CREATE TABLE IF NOT EXISTS public.social_publish_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  social_post_id uuid NULL REFERENCES public.social_posts(id) ON DELETE SET NULL,
  identity_id uuid NOT NULL REFERENCES public.social_identities(id) ON DELETE RESTRICT,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','linkedin')),
  requested_identity_type text NOT NULL,
  resolved_identity_type text NOT NULL,
  provider_identity_id text NOT NULL,
  requested_publish_time timestamptz NULL,
  normalized_caption text NOT NULL,
  media_asset_ids uuid[] NOT NULL DEFAULT '{}',
  media_checksum text NOT NULL,
  idempotency_key text NOT NULL,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  state text NOT NULL DEFAULT 'created' CHECK (state IN (
    'created','preflighting','uploading','provider_processing','verifying','published',
    'failed_retryable','failed_terminal','reconciliation_required','deleted'
  )),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider_container_id text NULL,
  provider_post_id text NULL,
  provider_permalink text NULL,
  provider_author_urn text NULL,
  provider_identity_verified boolean NOT NULL DEFAULT false,
  verification_timestamp timestamptz NULL,
  reconciliation_timestamp timestamptz NULL,
  retry_safe boolean NOT NULL DEFAULT false,
  retry_after timestamptz NULL,
  last_provider_response jsonb NULL,
  failure_code text NULL,
  failure_message text NULL,
  locked_by text NULL,
  locked_until timestamptz NULL,
  published_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS social_publish_operations_reconcile_idx
  ON public.social_publish_operations (state, retry_after, updated_at)
  WHERE state IN ('created','preflighting','uploading','provider_processing','verifying','reconciliation_required','failed_retryable');
CREATE INDEX IF NOT EXISTS social_publish_operations_tenant_post_idx
  ON public.social_publish_operations (tenant_id, social_post_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS social_publish_operations_provider_post_uq
  ON public.social_publish_operations (tenant_id, platform, provider_identity_id, provider_post_id)
  WHERE provider_post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS social_publish_operations_container_uq
  ON public.social_publish_operations (tenant_id, platform, provider_container_id)
  WHERE provider_container_id IS NOT NULL;

ALTER TABLE public.social_publish_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_publish_operations FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.social_publish_operations TO authenticated;

DROP POLICY IF EXISTS social_publish_operations_tenant_read ON public.social_publish_operations;
CREATE POLICY social_publish_operations_tenant_read
  ON public.social_publish_operations FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = social_publish_operations.tenant_id
        AND tu.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS social_publish_operations_tenant_insert ON public.social_publish_operations;
CREATE POLICY social_publish_operations_tenant_insert
  ON public.social_publish_operations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = social_publish_operations.tenant_id
        AND tu.user_id = (SELECT auth.uid())
        AND tu.role IN ('owner','admin','tenant_admin','member','editor')
    )
    AND EXISTS (
      SELECT 1 FROM public.social_identities si
      WHERE si.id = social_publish_operations.identity_id
        AND si.tenant_id = social_publish_operations.tenant_id
        AND si.provider = social_publish_operations.platform
    )
  );

DROP POLICY IF EXISTS social_publish_operations_tenant_update ON public.social_publish_operations;
CREATE POLICY social_publish_operations_tenant_update
  ON public.social_publish_operations FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = social_publish_operations.tenant_id
        AND tu.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = social_publish_operations.tenant_id
        AND tu.user_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS publish_operation_id uuid NULL REFERENCES public.social_publish_operations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_container_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_permalink text NULL,
  ADD COLUMN IF NOT EXISTS verification_timestamp timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_timestamp timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retry_safe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS structured_failure_code text NULL;

NOTIFY pgrst, 'reload schema';
