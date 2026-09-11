-- MCP connector: media/email action ledger + sender addresses + media_assets hardening.
-- Safe to re-run (IF NOT EXISTS).

BEGIN;

-- Ensure media_assets has columns used by ingestion (older envs may miss some).
ALTER TABLE IF EXISTS public.media_assets
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_checksum
  ON public.media_assets (tenant_id, checksum_sha256);
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_created
  ON public.media_assets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_user
  ON public.media_assets (user_id);

-- Connected email sender addresses (Zoho FromAddress fix / multi-provider)
CREATE TABLE IF NOT EXISTS public.email_sender_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  account_id TEXT,
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  region TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, email_address)
);

CREATE INDEX IF NOT EXISTS idx_email_sender_addresses_tenant
  ON public.email_sender_addresses (tenant_id, provider);

ALTER TABLE public.email_sender_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members read email sender addresses" ON public.email_sender_addresses;
CREATE POLICY "Tenant members read email sender addresses"
  ON public.email_sender_addresses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = email_sender_addresses.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins write email sender addresses" ON public.email_sender_addresses;
CREATE POLICY "Tenant admins write email sender addresses"
  ON public.email_sender_addresses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = email_sender_addresses.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin', 'tenant_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = email_sender_addresses.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('owner', 'admin', 'tenant_admin', 'super_admin')
    )
  );

-- Durable external action ledger (email/social/media) for MCP receipts + retries
CREATE TABLE IF NOT EXISTS public.external_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'awaiting_approval', 'queued', 'running',
      'provider_accepted', 'verification_pending', 'completed',
      'failed', 'cancelled', 'partially_completed'
    )),
  idempotency_key TEXT,
  input_hash TEXT,
  provider TEXT,
  provider_reference TEXT,
  live_url TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  failure_reason TEXT,
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, tool_name, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_external_actions_tenant_status
  ON public.external_actions (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_actions_provider_ref
  ON public.external_actions (tenant_id, provider, provider_reference);

ALTER TABLE public.external_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members read external actions" ON public.external_actions;
CREATE POLICY "Tenant members read external actions"
  ON public.external_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = external_actions.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

COMMIT;
