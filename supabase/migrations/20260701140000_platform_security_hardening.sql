-- Platform security hardening: RLS fixes, MCP key hashing, integration secrets side tables

-- ─── Twilio: service_role only (no USING true) ───
DROP POLICY IF EXISTS "Service role full access to twilio_integrations" ON public.twilio_integrations;

-- ─── MCP OAuth clients: deny authenticated; service_role bypasses RLS ───
DROP POLICY IF EXISTS "Service role only for clients" ON public.mcp_oauth_clients;
DROP POLICY IF EXISTS "mcp_oauth_clients_service_role" ON public.mcp_oauth_clients;

-- ─── MCP API keys: scope to owning user only ───
DROP POLICY IF EXISTS "tenant_members_manage_api_keys" ON public.mcp_api_keys;

ALTER TABLE public.mcp_api_keys
  ADD COLUMN IF NOT EXISTS api_key_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_api_keys_api_key_hash_key
  ON public.mcp_api_keys (api_key_hash)
  WHERE api_key_hash IS NOT NULL;

CREATE POLICY mcp_api_keys_owner_select ON public.mcp_api_keys
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY mcp_api_keys_owner_insert ON public.mcp_api_keys
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY mcp_api_keys_owner_update ON public.mcp_api_keys
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY mcp_api_keys_owner_delete ON public.mcp_api_keys
  FOR DELETE
  USING (user_id = auth.uid());

-- ─── Slack integration secrets ───
CREATE TABLE IF NOT EXISTS public.slack_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.slack_integrations(id) ON DELETE CASCADE,
  bot_access_token_encrypted TEXT,
  user_access_token_encrypted TEXT,
  webhook_url_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.slack_integration_secrets ENABLE ROW LEVEL SECURITY;

-- ─── Microsoft connection secrets ───
CREATE TABLE IF NOT EXISTS public.microsoft_connection_secrets (
  connection_user_id UUID PRIMARY KEY,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.microsoft_connection_secrets ENABLE ROW LEVEL SECURITY;

-- ─── Safe views: metadata without token columns for tenant members ───
CREATE OR REPLACE VIEW public.facebook_integrations_safe AS
SELECT
  id, tenant_id, user_id, page_id, page_name, app_scoped_user_id,
  is_active, expires_at, connected_at, updated_at, metadata
FROM public.facebook_integrations;

CREATE OR REPLACE VIEW public.linkedin_integrations_safe AS
SELECT
  id, tenant_id, user_id, linkedin_member_id, linkedin_person_urn,
  token_expires_at, scopes, metadata, is_active, created_at, updated_at
FROM public.linkedin_integrations;

GRANT SELECT ON public.facebook_integrations_safe TO authenticated;
GRANT SELECT ON public.linkedin_integrations_safe TO authenticated;

NOTIFY pgrst, 'reload schema';
