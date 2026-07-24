#!/usr/bin/env node
/**
 * Apply Claude MCP OAuth redirect migration using DATABASE_URL / SUPABASE_DB_URL from env.
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' node scripts/apply-claude-oauth-migration.mjs
 *   # or with .env.local / .env containing DATABASE_URL | SUPABASE_DB_URL | DIRECT_URL
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

function getEnv(key) {
  const envFiles = [
    ".env.local",
    ".env.production.local",
    ".env",
    ".env.vercel.local",
  ];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const line of content.split("\n")) {
        if (!line || line.trim().startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const k = line.slice(0, eq).trim();
        if (k !== key) continue;
        return line
          .slice(eq + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    } catch {
      // ignore
    }
  }
  return process.env[key];
}

const MIGRATION =
  "supabase/migrations/20260724210000_fix_claude_mcp_oauth_redirects.sql";

async function main() {
  const dbUrl =
    getEnv("DATABASE_URL") ||
    getEnv("SUPABASE_DB_URL") ||
    getEnv("DIRECT_URL") ||
    getEnv("POSTGRES_URL") ||
    getEnv("POSTGRES_PRISMA_URL");

  if (!dbUrl) {
    console.error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / DIRECT_URL / POSTGRES_URL in env or .env.local",
    );
    process.exit(1);
  }

  const full = path.resolve(process.cwd(), MIGRATION);
  if (!fs.existsSync(full)) {
    console.error(`Migration not found: ${MIGRATION}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(full, "utf8");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log("Connected to database");

  try {
    console.log(`Applying ${MIGRATION}...`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`OK ${MIGRATION}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    const verify = await client.query(`
      SELECT client_id, client_name, is_active,
             cardinality(redirect_uris) AS redirect_count,
             redirect_uris
      FROM public.mcp_oauth_clients
      WHERE client_id IN ('1778309945386-41bab8272f61', 'CLAUDE', 'claude-web')
         OR client_name ILIKE '%claude%'
      ORDER BY client_id
    `);
    console.log("Claude OAuth clients:");
    for (const row of verify.rows) {
      const uris = Array.isArray(row.redirect_uris) ? row.redirect_uris : [];
      const hasOauthCb = uris.includes("https://claude.ai/api/oauth/callback");
      const hasMcpCb = uris.includes("https://claude.ai/api/mcp/auth_callback");
      console.log(
        `  ${row.client_id}: redirects=${row.redirect_count} oauth_cb=${hasOauthCb} mcp_cb=${hasMcpCb} active=${row.is_active}`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
