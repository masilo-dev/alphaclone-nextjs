-- ============================================================
-- MCP OAuth Infrastructure Tables
-- Creates all tables required for OAuth 2.0 + PKCE flow,
-- API key management, and OAuth client registration.
-- ============================================================

-- ── 1. MCP API Keys ──────────────────────────────────────────
-- One API key per tenant user, used to authenticate automated agents.
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key       TEXT NOT NULL UNIQUE,
  label         TEXT,
  scopes        TEXT[] DEFAULT ARRAY['read', 'write'],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_tenant   ON mcp_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user     ON mcp_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_api_key  ON mcp_api_keys(api_key);

ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

<<<<<<< HEAD
DROP POLICY IF EXISTS "tenant_members_manage_api_keys" ON mcp_api_keys;
=======
>>>>>>> origin/main
CREATE POLICY "tenant_members_manage_api_keys" ON mcp_api_keys
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = mcp_api_keys.tenant_id
        AND tenant_users.user_id   = auth.uid()
    )
  );

-- ── 2. MCP OAuth Clients ─────────────────────────────────────
-- Registered OAuth 2.0 clients (Claude, Manus, custom agents).
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      TEXT NOT NULL UNIQUE,
  client_name    TEXT NOT NULL,
  redirect_uris  TEXT[] NOT NULL DEFAULT '{}',
  is_public      BOOLEAN NOT NULL DEFAULT TRUE,  -- public = PKCE only, no secret
  client_secret  TEXT,                           -- only for confidential clients
  scopes         TEXT[] DEFAULT ARRAY['read', 'write'],
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_client_id ON mcp_oauth_clients(client_id);

-- Add missing columns to pre-existing table (safe no-ops if already present)
ALTER TABLE mcp_oauth_clients ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE mcp_oauth_clients ADD COLUMN IF NOT EXISTS is_public     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE mcp_oauth_clients ADD COLUMN IF NOT EXISTS client_secret TEXT;
ALTER TABLE mcp_oauth_clients ADD COLUMN IF NOT EXISTS scopes        TEXT[]  DEFAULT ARRAY['read', 'write'];

-- Drop NOT NULL on client_secret — public clients (Claude, Manus) use PKCE and have no secret
ALTER TABLE mcp_oauth_clients ALTER COLUMN client_secret DROP NOT NULL;

-- Pre-register Claude as a known public client
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes)
VALUES (
  '1778309945386-41bab8272f61',
  'Claude (Anthropic)',
  ARRAY['https://claude.ai/api/mcp/auth_callback'],
  TRUE,
  NULL,
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources']
)
ON CONFLICT (client_id) DO UPDATE SET
  redirect_uris = EXCLUDED.redirect_uris,
  scopes        = EXCLUDED.scopes;

-- Pre-register Manus AI
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, scopes)
VALUES (
  'manus-ai',
  'Manus AI',
  ARRAY['https://manus.im/api/mcp/auth_callback', 'https://manus.ai/api/mcp/auth_callback'],
  TRUE,
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources']
)
ON CONFLICT (client_id) DO NOTHING;

-- ── 3. MCP OAuth Authorization Codes ─────────────────────────
-- Short-lived single-use codes issued at /api/mcp/authorize.
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  client_id             TEXT NOT NULL,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  redirect_uri          TEXT NOT NULL,
  scopes                TEXT[] DEFAULT ARRAY['read', 'write'],
  code_challenge        TEXT,
  code_challenge_method TEXT DEFAULT 'S256',
  used                  BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_code      ON mcp_oauth_codes(code);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expires   ON mcp_oauth_codes(expires_at);

-- Auto-delete used/expired codes after 1 hour (keep table lean)
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_codes() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM mcp_oauth_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour'
     OR (used = TRUE AND created_at < NOW() - INTERVAL '1 hour');
END;
$$;

-- ── 4. MCP OAuth Tokens ───────────────────────────────────────
-- Access + refresh tokens issued at /api/mcp/token.
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token   TEXT NOT NULL UNIQUE,
  refresh_token  TEXT UNIQUE,
  client_id      TEXT,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scopes         TEXT[] DEFAULT ARRAY['read', 'write'],
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_access   ON mcp_oauth_tokens(access_token);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_refresh  ON mcp_oauth_tokens(refresh_token);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_tenant   ON mcp_oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user     ON mcp_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_expires  ON mcp_oauth_tokens(expires_at);

ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

<<<<<<< HEAD
DROP POLICY IF EXISTS "tenant_members_view_own_tokens" ON mcp_oauth_tokens;
=======
>>>>>>> origin/main
CREATE POLICY "tenant_members_view_own_tokens" ON mcp_oauth_tokens
  FOR SELECT USING (user_id = auth.uid());

-- ── 5. MCP Event Queue ────────────────────────────────────────
-- Async event queue for MCP tool execution side-effects.
CREATE TABLE IF NOT EXISTS mcp_event_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  available_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_event_queue_status     ON mcp_event_queue(status, available_at);
CREATE INDEX IF NOT EXISTS idx_mcp_event_queue_tenant     ON mcp_event_queue(tenant_id);
