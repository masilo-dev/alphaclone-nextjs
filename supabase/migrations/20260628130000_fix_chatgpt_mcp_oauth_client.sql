-- Ensure ChatGPT MCP OAuth client is active with correct redirect URIs and scopes.
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
    'https://chat.openai.com/connector_platform_oauth_redirect',
    'https://chat.openai.com/connector/oauth/*'
  ]::text[],
  true,
  'public',
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources', 'openid', 'profile'],
  true
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  is_public = EXCLUDED.is_public,
  scopes = EXCLUDED.scopes,
  is_active = TRUE;
