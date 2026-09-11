-- Consolidate ChatGPT DCR client ids (ac_*) to the canonical chatgpt-connector
-- so the same AlphaClone tenant is recognized across different ChatGPT accounts.

UPDATE mcp_oauth_tokens t
SET client_id = 'chatgpt-connector',
    updated_at = NOW()
FROM mcp_oauth_clients c
WHERE t.client_id = c.client_id
  AND t.client_id LIKE 'ac_%'
  AND c.redirect_uris IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(c.redirect_uris) AS uri
    WHERE uri LIKE 'https://chatgpt.com/%'
       OR uri LIKE 'https://chat.openai.com/%'
       OR uri LIKE 'https://platform.openai.com/apps-manage/oauth/%'
  );

UPDATE mcp_oauth_codes oc
SET client_id = 'chatgpt-connector'
FROM mcp_oauth_clients c
WHERE oc.client_id = c.client_id
  AND oc.client_id LIKE 'ac_%'
  AND oc.used = false
  AND c.redirect_uris IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(c.redirect_uris) AS uri
    WHERE uri LIKE 'https://chatgpt.com/%'
       OR uri LIKE 'https://chat.openai.com/%'
       OR uri LIKE 'https://platform.openai.com/apps-manage/oauth/%'
  );

UPDATE mcp_oauth_clients
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"canonical_family":"chatgpt"}'::jsonb,
    updated_at = NOW()
WHERE client_id LIKE 'ac_%'
  AND redirect_uris IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(redirect_uris) AS uri
    WHERE uri LIKE 'https://chatgpt.com/%'
       OR uri LIKE 'https://chat.openai.com/%'
       OR uri LIKE 'https://platform.openai.com/apps-manage/oauth/%'
  );
