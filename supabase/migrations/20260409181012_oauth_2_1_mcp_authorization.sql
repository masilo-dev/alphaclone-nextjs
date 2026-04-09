-- Create OAuth 2.1 Server Tables for MCP

-- 1. mcp_oauth_clients (Dynamic Client Registration)
CREATE TABLE mcp_oauth_clients (
    client_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_secret TEXT NOT NULL,
    client_name TEXT NOT NULL,
    redirect_uris TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS but keep it internal to the backend mostly
ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
-- No public policies, this table is only queried by the service role natively.

-- 2. mcp_oauth_codes
CREATE TABLE mcp_oauth_codes (
    code TEXT PRIMARY KEY,
    client_id UUID REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;

-- 3. mcp_oauth_tokens
CREATE TABLE mcp_oauth_tokens (
    access_token TEXT PRIMARY KEY,
    refresh_token TEXT UNIQUE,
    client_id UUID REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    scopes TEXT[] NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Index for token lookups on the SSE route
CREATE INDEX idx_mcp_oauth_tokens_access_token ON mcp_oauth_tokens(access_token);
