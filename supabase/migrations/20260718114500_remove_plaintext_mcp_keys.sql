CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.mcp_api_keys ADD COLUMN IF NOT EXISTS api_key_hash text;
UPDATE public.mcp_api_keys
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key IS NOT NULL AND (api_key_hash IS NULL OR api_key_hash = '');
UPDATE public.mcp_api_keys SET api_key = NULL WHERE api_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mcp_api_keys_hash_key
  ON public.mcp_api_keys(api_key_hash) WHERE api_key_hash IS NOT NULL;

COMMENT ON COLUMN public.mcp_api_keys.api_key IS
  'Deprecated plaintext field. Must remain NULL; keys are shown once and stored by SHA-256 hash.';

NOTIFY pgrst, 'reload schema';
