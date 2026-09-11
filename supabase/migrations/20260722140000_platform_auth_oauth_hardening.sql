-- ============================================================
-- Platform auth hardening: MCP OAuth schema contract, ChatGPT
-- client seed, tenants.status alignment, code consume columns.
-- Idempotent / safe for existing production rows.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── mcp_oauth_tokens schema contract ─────────────────────────
ALTER TABLE public.mcp_oauth_tokens
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS access_token_hash text,
  ADD COLUMN IF NOT EXISTS refresh_token_hash text,
  ADD COLUMN IF NOT EXISTS token_type text DEFAULT 'Bearer',
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS resource text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_family_id uuid;

-- Backfill hashes for existing plaintext tokens (compatibility window)
UPDATE public.mcp_oauth_tokens
SET access_token_hash = encode(digest(access_token, 'sha256'), 'hex')
WHERE access_token IS NOT NULL
  AND (access_token_hash IS NULL OR access_token_hash = '');

UPDATE public.mcp_oauth_tokens
SET refresh_token_hash = encode(digest(refresh_token, 'sha256'), 'hex')
WHERE refresh_token IS NOT NULL
  AND (refresh_token_hash IS NULL OR refresh_token_hash = '');

-- Ensure id populated
UPDATE public.mcp_oauth_tokens
SET id = gen_random_uuid()
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_id_uidx
  ON public.mcp_oauth_tokens(id);

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_active_lookup_idx
  ON public.mcp_oauth_tokens(client_id, user_id, tenant_id, revoked, expires_at);

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_refresh_lookup_idx
  ON public.mcp_oauth_tokens(refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_access_hash_lookup_idx
  ON public.mcp_oauth_tokens(access_token_hash)
  WHERE access_token_hash IS NOT NULL;

-- ── mcp_oauth_codes consume tracking ─────────────────────────
ALTER TABLE public.mcp_oauth_codes
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS resource text,
  ADD COLUMN IF NOT EXISTS used boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS mcp_oauth_codes_code_hash_idx
  ON public.mcp_oauth_codes(code_hash)
  WHERE code_hash IS NOT NULL;

-- ── mcp_oauth_clients contract + ChatGPT seed ────────────────
ALTER TABLE public.mcp_oauth_clients
  ADD COLUMN IF NOT EXISTS grant_types text[] DEFAULT ARRAY['authorization_code', 'refresh_token'],
  ADD COLUMN IF NOT EXISTS response_types text[] DEFAULT ARRAY['code'],
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

INSERT INTO public.mcp_oauth_clients (
  client_id,
  client_name,
  redirect_uris,
  is_public,
  client_secret,
  scopes,
  is_active,
  grant_types,
  response_types,
  token_endpoint_auth_method
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
  true,
  ARRAY['authorization_code', 'refresh_token'],
  ARRAY['code'],
  'none'
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  is_public = TRUE,
  scopes = EXCLUDED.scopes,
  is_active = TRUE,
  grant_types = EXCLUDED.grant_types,
  response_types = EXCLUDED.response_types,
  token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method,
  updated_at = now();

-- ── tenants.status (admin UI contract; distinct from subscription_status) ─
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.tenants
SET status = CASE
  WHEN subscription_status IN ('suspended', 'cancelled', 'canceled') THEN 'suspended'
  WHEN subscription_status = 'trialing' OR subscription_status = 'trial' THEN 'trial'
  WHEN subscription_status IN ('inactive', 'paused') THEN 'inactive'
  ELSE COALESCE(status, 'active')
END
WHERE status IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN status SET DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('active', 'suspended', 'disabled', 'pending', 'inactive', 'trial'));
  END IF;
EXCEPTION
  WHEN others THEN
    -- Constraint may fail on dirty data; leave column without check rather than abort deploy
    RAISE NOTICE 'tenants_status_check skipped: %', SQLERRM;
END $$;

-- ── Audit log helper: service-role inserts remain via service key; ────────
-- Ensure service_role policy exists (idempotent with prior migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
