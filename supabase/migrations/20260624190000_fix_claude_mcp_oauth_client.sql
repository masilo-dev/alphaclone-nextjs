-- ============================================================================
-- Fix Claude.ai MCP OAuth Client Registration
-- Resolves "ofid_39198e394feb99f2" error when Claude.ai connects to AlphaClone
-- ============================================================================

-- Ensure Claude.ai OAuth client is properly registered with all required redirect URIs
-- Claude Desktop and Claude Web use different client IDs and redirect patterns

-- 1. Register the Claude Desktop client (uses numeric client_id)
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active)
VALUES (
  '1778309945386-41bab8272f61',
  'Claude Desktop (Anthropic)',
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

-- 2. Register the generic CLAUDE client (for backward compatibility)
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active)
VALUES (
  'CLAUDE',
  'Claude AI (Legacy)',
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

-- 3. Register Claude Web/Cloud client (if using different client_id pattern)
INSERT INTO mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active)
VALUES (
  'claude-web',
  'Claude Web (Anthropic)',
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

-- 4. Ensure all Claude-related clients are active and have proper scopes
UPDATE mcp_oauth_clients 
SET is_active = TRUE,
    is_public = TRUE,
    scopes = ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile']
WHERE client_id LIKE '%claude%'
   OR client_id LIKE '%1778%'
   OR client_name ILIKE '%claude%';

-- 5. Log the fix
DO $$
BEGIN
  RAISE NOTICE 'Claude.ai MCP OAuth client registration fixed. Clients updated:';
  
  PERFORM client_id, client_name, is_active 
  FROM mcp_oauth_clients 
  WHERE client_id IN ('1778309945386-41bab8272f61', 'CLAUDE', 'claude-web');
END $$;
