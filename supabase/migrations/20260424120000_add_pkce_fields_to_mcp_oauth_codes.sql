ALTER TABLE mcp_oauth_codes
ADD COLUMN IF NOT EXISTS code_challenge TEXT,
ADD COLUMN IF NOT EXISTS code_challenge_method TEXT;

UPDATE mcp_oauth_codes
SET code_challenge_method = 'S256'
WHERE code_challenge_method IS NULL;
