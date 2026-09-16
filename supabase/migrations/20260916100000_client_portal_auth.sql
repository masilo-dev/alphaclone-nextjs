-- Client finance portal password auth + session audit trail.
-- Adds password_hash/salt columns on business_clients and a client_portal_sessions
-- append-only audit table for sign-in / sign-out events. Idempotent (IF NOT EXISTS)
-- so re-running on already-migrated environments is a no-op.

BEGIN;

ALTER TABLE public.business_clients
  ADD COLUMN IF NOT EXISTS client_portal_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS client_portal_session_salt TEXT,
  ADD COLUMN IF NOT EXISTS client_portal_password_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_portal_last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_portal_login_failure_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS client_portal_locked_until TIMESTAMPTZ;

COMMENT ON COLUMN public.business_clients.client_portal_password_hash IS 'sha256:salt:hash — shared format with projects.portal_password_hash — client finance portal password';
COMMENT ON COLUMN public.business_clients.client_portal_session_salt IS 'Per-client random opaque salt rotated on force-logout / password change; all outstanding JWT sessions embed this salt so rotation invalidates them instantly';
COMMENT ON COLUMN public.business_clients.client_portal_password_set_at IS 'Timestamp when the client first (or last) set a portal password';
COMMENT ON COLUMN public.business_clients.client_portal_last_login_at IS 'Audit — most recent successful client portal login';
COMMENT ON COLUMN public.business_clients.client_portal_login_failure_count IS 'Incremented on each wrong-password submit; reset to 0 on success; triggers lockout at >=10 within a window';
COMMENT ON COLUMN public.business_clients.client_portal_locked_until IS 'When set, all login attempts for this client are rejected until this timestamp (rate-limit / brute-force lockout)';

CREATE TABLE IF NOT EXISTS public.client_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.business_clients(id) ON DELETE CASCADE,
  session_jti UUID NOT NULL UNIQUE,
  session_salt TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  signed_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_out_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_client_active
  ON public.client_portal_sessions (client_id, is_active, signed_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_tenant
  ON public.client_portal_sessions (tenant_id, signed_in_at DESC);

ALTER TABLE public.client_portal_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_portal_sessions_tenant_isolation
  ON public.client_portal_sessions;

CREATE POLICY client_portal_sessions_tenant_isolation
  ON public.client_portal_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE
        tu.tenant_id = client_portal_sessions.tenant_id
        AND auth.uid() IS NOT DISTINCT FROM tu.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tenant_users tu
      WHERE
        tu.tenant_id = client_portal_sessions.tenant_id
        AND auth.uid() IS NOT DISTINCT FROM tu.user_id
    )
  );

COMMIT;
