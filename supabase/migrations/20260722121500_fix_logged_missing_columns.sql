-- Catch-up for production schema drift reported in Postgres logs (2026-07-22).
-- Safe to re-run: all statements are IF NOT EXISTS / OR REPLACE.

-- ─── tenants branding ─────────────────────────────────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS brand_color_primary TEXT DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT DEFAULT '#14b8a6',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ─── invoice line items ordering ───────────────────────────────
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_tenant_invoice_position
  ON public.invoice_line_items (tenant_id, invoice_id, position ASC);

-- ─── MCP OAuth token revocation ───────────────────────────────
ALTER TABLE public.mcp_oauth_tokens
  ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resource TEXT,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY['read', 'write'];

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_revoked
  ON public.mcp_oauth_tokens (revoked)
  WHERE revoked = FALSE;

-- ─── Slack integrations (legacy plaintext columns optional) ───
ALTER TABLE public.slack_integrations
  ADD COLUMN IF NOT EXISTS bot_access_token TEXT,
  ADD COLUMN IF NOT EXISTS user_access_token TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS scope TEXT;

-- ─── Calendar entity sync ─────────────────────────────────────
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS related_entity_id UUID,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_calendar_events_related_entity
  ON public.calendar_events (tenant_id, type, related_entity_id)
  WHERE related_entity_id IS NOT NULL;

-- ─── Tenant context helper used by management routes ──────────
CREATE OR REPLACE FUNCTION public.set_tenant_context(tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prefer set_config (custom GUCs); never fail callers if host rejects the name.
  BEGIN
    PERFORM set_config('app.current_tenant_id', COALESCE(tenant_id::text, ''), true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_tenant_context(uuid) TO authenticated, service_role, anon;
