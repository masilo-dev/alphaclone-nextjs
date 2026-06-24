-- ============================================================================
-- Claude.ai MCP OAuth Client Registration Fix
-- Run this in Supabase Dashboard SQL Editor to fix OAuth connection issues
-- ============================================================================

-- Register Claude Desktop client (numeric ID is what Claude.ai actually sends)
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active)
VALUES (
  '1778309945386-41bab8272f61',
  'Claude Desktop Anthropic',
  ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/settings/oauth-callback',
    'https://api.claude.ai/v1/oauth/callback',
    'https://claude.ai/api/oauth/callback'
  ],
  TRUE,
  NULL,
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  TRUE
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  scopes = EXCLUDED.scopes,
  is_active = TRUE;

-- Register legacy CLAUDE client for backward compatibility
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active)
VALUES (
  'CLAUDE',
  'Claude AI Legacy',
  ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/oauth/callback',
    'https://claude.ai/auth/callback'
  ],
  TRUE,
  NULL,
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  TRUE
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  scopes = EXCLUDED.scopes,
  is_active = TRUE;

-- Register Claude Web client
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active)
VALUES (
  'claude-web',
  'Claude Web Anthropic',
  ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/oauth/callback',
    'https://www.claude.ai/api/mcp/auth_callback'
  ],
  TRUE,
  NULL,
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  TRUE
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  scopes = EXCLUDED.scopes,
  is_active = TRUE;

-- Verify the fix worked
SELECT 
  client_id,
  client_name,
  is_active,
  is_public,
  array_length(redirect_uris, 1) as num_redirect_uris,
  scopes
FROM mcp_oauth_clients
WHERE client_id IN ('1778309945386-41bab8272f61', 'CLAUDE', 'claude-web')
ORDER BY client_id;
