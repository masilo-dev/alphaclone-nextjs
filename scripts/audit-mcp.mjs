import fs from 'node:fs';

const checks = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260727150000_mcp_oauth_grants_multiclient_hardening.sql');
const discovery = read('src/lib/mcp/listAllTools.ts');
const tokenRoute = read('src/app/api/mcp/token/route.ts');

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const originSources = [
  'src/lib/mcpWellKnown.ts',
  'src/lib/config/public-origin.ts',
  'src/app/api/mcp/token/route.ts',
  'src/app/api/mcp/authorize/route.ts',
].filter((path) => fs.existsSync(path));
check('production origin', !originSources.some((path) => /railway\.app/.test(read(path))), 'No Railway origin in MCP/OAuth source');
check('grant model', /CREATE TABLE IF NOT EXISTS public\.mcp_oauth_grants/.test(migration), 'Grant table migration exists');
check('unsafe unique index removed', /DROP INDEX IF EXISTS public\.mcp_oauth_tokens_active_user_client_uidx/.test(migration), 'Per-user/client uniqueness removed');
check('token hashes', /access_token_hash/.test(tokenRoute) && /refresh_token_hash/.test(tokenRoute), 'Hashed lookup/storage present');
check('token encryption', /access_token_encrypted/.test(tokenRoute) && /refresh_token_encrypted/.test(tokenRoute), 'Encrypted storage present');
check('progressive discovery', /coreTools\(cachedFullTools, 32\)/.test(discovery), 'Core catalogue is capped');
check('durable jobs', /CREATE TABLE IF NOT EXISTS public\.mcp_jobs/.test(migration), 'Postgres queue exists');
check('tenant RLS', /ENABLE ROW LEVEL SECURITY/.test(migration), 'New tenant tables have RLS');

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`);
if (checks.some((item) => !item.ok)) process.exitCode = 1;
