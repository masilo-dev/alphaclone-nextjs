-- ============================================================================
-- Simple Claude OAuth Fix - Run Each Block Separately if Needed
-- ============================================================================

-- ============================================================================
-- BLOCK 1: Check if table exists and what clients are already there
-- ============================================================================
SELECT 
  client_id,
  client_name,
  is_active,
  array_length(redirect_uris, 1) as num_redirect_uris
FROM mcp_oauth_clients
WHERE client_name ILIKE '%claude%'
   OR client_id LIKE '%1778%'
   OR client_id = 'CLAUDE'
   OR client_id = 'claude-web';

-- ============================================================================
-- BLOCK 2: Insert Claude Desktop client (run this if not found above)
-- ============================================================================
INSERT INTO mcp_oauth_clients (
  client_id,
  client_name,
  redirect_uris,
  is_public,
  client_secret,
  scopes,
  is_active
) VALUES (
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
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- BLOCK 3: Update existing Claude Desktop client if it exists
-- ============================================================================
UPDATE mcp_oauth_clients
SET 
  client_name = 'Claude Desktop Anthropic',
  redirect_uris = ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/settings/oauth-callback',
    'https://api.claude.ai/v1/oauth/callback',
    'https://claude.ai/api/oauth/callback'
  ],
  scopes = ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  is_active = TRUE,
  is_public = TRUE
WHERE client_id = '1778309945386-41bab8272f61';

-- ============================================================================
-- BLOCK 4: Insert legacy CLAUDE client
-- ============================================================================
INSERT INTO mcp_oauth_clients (
  client_id,
  client_name,
  redirect_uris,
  is_public,
  client_secret,
  scopes,
  is_active
) VALUES (
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
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- BLOCK 5: Update legacy CLAUDE client if it exists
-- ============================================================================
UPDATE mcp_oauth_clients
SET 
  client_name = 'Claude AI Legacy',
  redirect_uris = ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/oauth/callback',
    'https://claude.ai/auth/callback'
  ],
  scopes = ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  is_active = TRUE,
  is_public = TRUE
WHERE client_id = 'CLAUDE';

-- ============================================================================
-- BLOCK 6: Insert Claude Web client
-- ============================================================================
INSERT INTO mcp_oauth_clients (
  client_id,
  client_name,
  redirect_uris,
  is_public,
  client_secret,
  scopes,
  is_active
) VALUES (
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
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================================
-- BLOCK 7: Update Claude Web client if it exists
-- ============================================================================
UPDATE mcp_oauth_clients
SET 
  client_name = 'Claude Web Anthropic',
  redirect_uris = ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/oauth/callback',
    'https://www.claude.ai/api/mcp/auth_callback'
  ],
  scopes = ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  is_active = TRUE,
  is_public = TRUE
WHERE client_id = 'claude-web';

-- ============================================================================
-- BLOCK 8: Final verification - check all Claude clients
-- ============================================================================
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
