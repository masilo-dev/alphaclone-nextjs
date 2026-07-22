#!/usr/bin/env node
/**
 * Apply MCP auth hotfix migrations against DATABASE_URL / SUPABASE_DB_URL.
 * Usage: node scripts/apply-mcp-auth-migrations.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

function getEnv(key) {
  const envFiles = ['.env.local', '.env.production.local', '.env', '.env.vercel.local'];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k.trim() === key) {
          return v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // ignore
    }
  }
  return process.env[key];
}

const MIGRATIONS = [
  'supabase/migrations/20260722140000_platform_auth_oauth_hardening.sql',
  'supabase/migrations/20260722153000_mcp_auth_hotfixes.sql',
];

async function main() {
  const dbUrl =
    getEnv('DATABASE_URL') ||
    getEnv('SUPABASE_DB_URL') ||
    getEnv('DIRECT_URL') ||
    getEnv('POSTGRES_URL');

  if (!dbUrl) {
    console.error('Missing DATABASE_URL / SUPABASE_DB_URL / DIRECT_URL');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log('Connected to database');

  try {
    for (const file of MIGRATIONS) {
      const full = path.resolve(process.cwd(), file);
      if (!fs.existsSync(full)) {
        throw new Error(`Migration not found: ${file}`);
      }
      const sql = fs.readFileSync(full, 'utf8');
      console.log(`Applying ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`OK ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    // Verify critical contract
    const checks = await client.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='mcp_oauth_tokens' AND column_name='revoked'
        ) AS has_revoked,
        EXISTS (
          SELECT 1 FROM public.mcp_oauth_clients WHERE client_id='chatgpt-connector' AND COALESCE(is_active, true) = true
        ) AS has_chatgpt_client,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='tenants' AND column_name='status'
        ) AS has_tenant_status
    `);
    console.log('Verification:', checks.rows[0]);
    const row = checks.rows[0];
    if (!row.has_revoked || !row.has_chatgpt_client) {
      console.error('Verification failed');
      process.exit(2);
    }
    console.log('MCP auth migrations applied and verified');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  if (err.detail) console.error('Detail:', err.detail);
  if (err.hint) console.error('Hint:', err.hint);
  process.exit(1);
});
