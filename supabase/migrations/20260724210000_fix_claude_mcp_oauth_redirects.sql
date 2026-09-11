-- ============================================================================
-- Restore / expand Claude MCP OAuth redirect URIs
-- Fixes Claude.ai McpAuthorizationError when seed upserts had shrunk the allowlist,
-- and ensures post-OAuth callbacks Anthropic uses are always registered.
-- ============================================================================

-- Merge (union) Claude redirect URIs without dropping any already-registered ones
UPDATE public.mcp_oauth_clients
SET
  redirect_uris = (
    SELECT ARRAY(
      SELECT DISTINCT trim(both FROM u)
      FROM unnest(
        COALESCE(redirect_uris, '{}'::text[])
        || ARRAY[
          'https://claude.ai/api/mcp/auth_callback',
          'https://claude.ai/api/oauth/callback',
          'https://claude.ai/settings/oauth-callback',
          'https://claude.ai/auth/callback',
          'https://api.claude.ai/v1/oauth/callback',
          'https://www.claude.ai/api/mcp/auth_callback',
          'https://www.claude.ai/api/oauth/callback'
        ]
      ) AS u
      WHERE trim(both FROM u) <> ''
    )
  ),
  is_active = TRUE,
  is_public = TRUE
WHERE client_id IN ('1778309945386-41bab8272f61', 'CLAUDE', 'claude-web')
   OR client_name ILIKE '%claude%';

-- Ensure primary Claude Desktop/Web client row exists
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
  '1778309945386-41bab8272f61',
  'Claude (Anthropic)',
  ARRAY[
    'https://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/oauth/callback',
    'https://claude.ai/settings/oauth-callback',
    'https://claude.ai/auth/callback',
    'https://api.claude.ai/v1/oauth/callback',
    'https://www.claude.ai/api/mcp/auth_callback',
    'https://www.claude.ai/api/oauth/callback'
  ],
  TRUE,
  'public',
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  TRUE
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = (
    SELECT ARRAY(
      SELECT DISTINCT trim(both FROM u)
      FROM unnest(COALESCE(mcp_oauth_clients.redirect_uris, '{}'::text[]) || EXCLUDED.redirect_uris) AS u
      WHERE trim(both FROM u) <> ''
    )
  ),
  is_public = TRUE,
  is_active = TRUE;
