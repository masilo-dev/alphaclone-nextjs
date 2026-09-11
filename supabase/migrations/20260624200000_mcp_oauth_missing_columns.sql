-- Columns referenced by MCP OAuth token/register routes but missing on older production schemas

ALTER TABLE public.mcp_oauth_tokens ADD COLUMN IF NOT EXISTS resource TEXT;

ALTER TABLE public.mcp_oauth_clients ADD COLUMN IF NOT EXISTS grant_types TEXT[] DEFAULT ARRAY['authorization_code', 'refresh_token'];
ALTER TABLE public.mcp_oauth_clients ADD COLUMN IF NOT EXISTS response_types TEXT[] DEFAULT ARRAY['code'];
ALTER TABLE public.mcp_oauth_clients ADD COLUMN IF NOT EXISTS token_endpoint_auth_method TEXT DEFAULT 'none';
