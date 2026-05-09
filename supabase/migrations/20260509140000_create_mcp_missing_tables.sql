-- ============================================================
-- MCP OAuth Tokens + Sessions Tables
-- Targeted fix: these tables were not reached in earlier migration
-- runs that errored out at the mcp_oauth_clients INSERT step.
-- All statements are IF NOT EXISTS — safe to re-run.
-- ============================================================

-- ── mcp_oauth_tokens ─────────────────────────────────────────
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

-- ── mcp_oauth_codes ───────────────────────────────────────────
-- Short-lived single-use authorization codes (may already exist).
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

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_code    ON mcp_oauth_codes(code);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expires ON mcp_oauth_codes(expires_at);

-- ── mcp_sessions ─────────────────────────────────────────────
-- SSE connection session tracking (used by /api/mcp/sse).
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_sessions_tenant  ON mcp_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_expires ON mcp_sessions(expires_at);

-- ── mcp_api_keys (ensure exists) ─────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_api_key ON mcp_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_tenant  ON mcp_api_keys(tenant_id);

-- RLS (no-op if already enabled)
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Safe policy creation: ignore if already exists
DO $$
BEGIN
  CREATE POLICY "tenant_members_manage_api_keys" ON mcp_api_keys
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM tenant_users
        WHERE tenant_users.tenant_id = mcp_api_keys.tenant_id
          AND tenant_users.user_id   = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "tenant_members_view_own_tokens" ON mcp_oauth_tokens
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
