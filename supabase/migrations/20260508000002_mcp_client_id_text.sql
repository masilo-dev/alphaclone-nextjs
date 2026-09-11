-- Hotfix: Convert client_id from UUID to TEXT to support AI Agents (Claude, Grok)
-- This allows human-readable client IDs like 'CLAUDE' or 'grok-connector'

-- 1. Drop foreign keys temporarily
ALTER TABLE mcp_oauth_codes DROP CONSTRAINT IF EXISTS mcp_oauth_codes_client_id_fkey;
ALTER TABLE mcp_oauth_tokens DROP CONSTRAINT IF EXISTS mcp_oauth_tokens_client_id_fkey;

-- 2. Change column types to TEXT
ALTER TABLE mcp_oauth_clients ALTER COLUMN client_id TYPE TEXT USING client_id::text;
ALTER TABLE mcp_oauth_codes ALTER COLUMN client_id TYPE TEXT USING client_id::text;
ALTER TABLE mcp_oauth_tokens ALTER COLUMN client_id TYPE TEXT USING client_id::text;

-- 3. Restore foreign keys
ALTER TABLE mcp_oauth_codes ADD CONSTRAINT mcp_oauth_codes_client_id_fkey 
    FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE;

ALTER TABLE mcp_oauth_tokens ADD CONSTRAINT mcp_oauth_tokens_client_id_fkey 
    FOREIGN KEY (client_id) REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE;

-- 4. Default for client_id in clients table (if needed)
ALTER TABLE mcp_oauth_clients ALTER COLUMN client_id SET DEFAULT gen_random_uuid()::text;
