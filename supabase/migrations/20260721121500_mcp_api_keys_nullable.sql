-- Repair migration for hosted DBs where remove_plaintext ran before api_key was nullable.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.mcp_api_keys ADD COLUMN IF NOT EXISTS api_key_hash text;

ALTER TABLE public.mcp_api_keys
  ALTER COLUMN api_key DROP NOT NULL;

UPDATE public.mcp_api_keys
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key IS NOT NULL
  AND api_key NOT LIKE 'ac_mcp_%'
  AND (api_key_hash IS NULL OR api_key_hash = '');

UPDATE public.mcp_api_keys
SET api_key_hash = api_key
WHERE api_key IS NOT NULL
  AND (api_key_hash IS NULL OR api_key_hash = '')
  AND length(api_key) = 64;

UPDATE public.mcp_api_keys
SET api_key = NULL
WHERE api_key IS NOT NULL
  AND api_key_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_api_keys_hash_key
  ON public.mcp_api_keys(api_key_hash) WHERE api_key_hash IS NOT NULL;

NOTIFY pgrst, 'reload schema';
