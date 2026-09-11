-- Hotfix migration: columns/clients required by live MCP auth (idempotent).
-- Apply ASAP if production still reports:
--   column mcp_oauth_tokens.revoked does not exist
--   Client authentication failed - client not found: chatgpt-connector
--   column tenants.status does not exist

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.mcp_oauth_tokens
  ADD COLUMN IF NOT EXISTS revoked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS resource text,
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS access_token_hash text,
  ADD COLUMN IF NOT EXISTS refresh_token_hash text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

ALTER TABLE public.mcp_oauth_clients
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  ADD COLUMN IF NOT EXISTS grant_types text[] DEFAULT ARRAY['authorization_code', 'refresh_token'],
  ADD COLUMN IF NOT EXISTS response_types text[] DEFAULT ARRAY['code'],
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method text DEFAULT 'none';

INSERT INTO public.mcp_oauth_clients (
  client_id,
  client_name,
  redirect_uris,
  is_public,
  client_secret,
  scopes,
  is_active
)
VALUES (
  'chatgpt-connector',
  'ChatGPT',
  ARRAY[
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'https://chatgpt.com/connector/oauth/*',
    'https://chatgpt.com/connector/oauth/callback',
    'https://chat.openai.com/connector_platform_oauth_redirect',
    'https://chat.openai.com/connector/oauth/*',
    'https://chat.openai.com/connector/oauth/callback',
    'https://platform.openai.com/apps-manage/oauth/*'
  ]::text[],
  true,
  'public',
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  true
)
ON CONFLICT (client_id) DO UPDATE SET
  redirect_uris = EXCLUDED.redirect_uris,
  is_public = TRUE,
  scopes = EXCLUDED.scopes,
  is_active = TRUE;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.tenants
SET status = COALESCE(status, 'active')
WHERE status IS NULL;

-- Ensure service_role can insert audit_logs (RLS stays on for authenticated users)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Service role manages audit logs" ON public.audit_logs';
    EXECUTE 'CREATE POLICY "Service role manages audit logs" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
