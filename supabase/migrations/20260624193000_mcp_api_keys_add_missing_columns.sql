-- Add missing columns to mcp_api_keys (safe if table was created from older migration)
ALTER TABLE public.mcp_api_keys ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.mcp_api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY['read', 'write'];
ALTER TABLE public.mcp_api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.mcp_api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill scopes for existing rows
UPDATE public.mcp_api_keys
SET scopes = ARRAY['read', 'write', 'mcp:tools', 'mcp:resources']
WHERE scopes IS NULL;
