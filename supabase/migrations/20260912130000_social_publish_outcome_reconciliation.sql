-- Provider writes with ambiguous transport outcomes must not be classified as
-- rejected or retried automatically.
ALTER TYPE public.social_post_status ADD VALUE IF NOT EXISTS 'outcome_unknown';

ALTER TABLE IF EXISTS public.external_actions
  ADD COLUMN IF NOT EXISTS action_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS execution_mode text,
  ADD COLUMN IF NOT EXISTS target jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_actions_action_id
  ON public.external_actions (action_id);

ALTER TABLE IF EXISTS public.external_actions
  DROP CONSTRAINT IF EXISTS external_actions_status_check;

ALTER TABLE IF EXISTS public.external_actions
  ADD CONSTRAINT external_actions_status_check CHECK (status IN (
    'pending', 'awaiting_approval', 'queued', 'running', 'provider_accepted',
    'verification_pending', 'outcome_unknown', 'completed', 'failed',
    'cancelled', 'partially_completed'
  )) NOT VALID;

ALTER TABLE IF EXISTS public.external_actions
  VALIDATE CONSTRAINT external_actions_status_check;

-- Backfill incomplete MCP receipts from durable social_posts evidence.
UPDATE public.mcp_action_receipts receipt
SET provider = COALESCE(receipt.provider, post.provider,
      CASE WHEN post.linkedin_post_urn IS NOT NULL THEN 'linkedin'
           WHEN post.facebook_post_id IS NOT NULL THEN 'facebook' END),
    provider_reference = COALESCE(receipt.provider_reference, post.linkedin_post_urn, post.facebook_post_id),
    entity_id = COALESCE(receipt.entity_id, post.id::text),
    entity_type = COALESCE(receipt.entity_type, 'social_post'),
    live_url = COALESCE(receipt.live_url, post.live_url),
    success = CASE WHEN post.status = 'published' AND
      (post.linkedin_post_urn IS NOT NULL OR post.facebook_post_id IS NOT NULL)
      THEN true ELSE receipt.success END,
    final_status = CASE WHEN post.status = 'published' AND
      (post.linkedin_post_urn IS NOT NULL OR post.facebook_post_id IS NOT NULL)
      THEN 'published' ELSE receipt.final_status END,
    verification = COALESCE(receipt.verification, '{}'::jsonb) || jsonb_build_object(
      'backfilled_from_social_posts', true,
      'provider_reference_present', post.linkedin_post_urn IS NOT NULL OR post.facebook_post_id IS NOT NULL
    )
FROM public.social_posts post
WHERE receipt.tenant_id = post.tenant_id
  AND (
    receipt.entity_id = post.id::text
    OR (receipt.correlation_id IS NOT NULL AND receipt.correlation_id::text = post.correlation_id::text)
    OR (receipt.idempotency_key IS NOT NULL AND receipt.idempotency_key = post.idempotency_key)
  )
  AND (
    receipt.provider_reference IS NULL OR receipt.entity_id IS NULL OR
    receipt.entity_type IS NULL OR receipt.final_status IS NULL
  );

-- The execution ledger is the earliest receipt available while the request is
-- still running, so repair it from provider evidence as well.
UPDATE public.external_actions action
SET provider = COALESCE(action.provider, post.provider,
      CASE WHEN post.linkedin_post_urn IS NOT NULL THEN 'linkedin'
           WHEN post.facebook_post_id IS NOT NULL THEN 'facebook' END),
    provider_reference = COALESCE(action.provider_reference, post.linkedin_post_urn, post.facebook_post_id),
    live_url = COALESCE(action.live_url, post.live_url),
    status = CASE WHEN post.status = 'published' AND
      (post.linkedin_post_urn IS NOT NULL OR post.facebook_post_id IS NOT NULL)
      THEN 'completed' ELSE action.status END,
    completed_at = CASE WHEN post.status = 'published' THEN COALESCE(action.completed_at, post.published_at, now())
      ELSE action.completed_at END
FROM public.social_posts post
WHERE action.tenant_id = post.tenant_id
  AND (
    action.action_id::text = post.correlation_id::text
    OR (action.idempotency_key IS NOT NULL AND action.idempotency_key = post.idempotency_key)
  )
  AND (action.provider_reference IS NULL OR action.provider IS NULL);

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_idempotency_identity
  ON public.social_posts (tenant_id, idempotency_key, provider, identity_type)
  WHERE idempotency_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
