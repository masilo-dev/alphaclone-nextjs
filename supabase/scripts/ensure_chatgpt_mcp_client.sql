-- Run in Supabase SQL Editor after MCP key migration.
-- Registers ChatGPT connector OAuth client required for ChatGPT MCP.

INSERT INTO public.mcp_oauth_clients (client_id, client_name, redirect_uris, is_public, client_secret)
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
  'public'
)
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  is_public = EXCLUDED.is_public;

-- Verify
SELECT client_id, client_name, redirect_uris, is_public
FROM public.mcp_oauth_clients
WHERE client_id = 'chatgpt-connector';
