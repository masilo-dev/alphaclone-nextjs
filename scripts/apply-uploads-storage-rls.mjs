#!/usr/bin/env node
/**
 * Apply tenant membership helper fix + uploads Storage RLS.
 * Fixes: ERROR 42703 column tu.status does not exist
 * Usage: DATABASE_URL='postgresql://...' node scripts/apply-uploads-storage-rls.mjs
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

const MIGRATIONS = [
  "supabase/migrations/20260724230000_fix_tenant_status_and_uploads_rls.sql",
  "supabase/migrations/20260724230001_uploads_storage_policies_dashboard.sql",
];

async function main() {
  const dbUrl =
    getEnv("DATABASE_URL") ||
    getEnv("SUPABASE_DB_URL") ||
    getEnv("DIRECT_URL") ||
    getEnv("POSTGRES_URL") ||
    getEnv("POSTGRES_PRISMA_URL");

  if (!dbUrl) {
    console.error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / DIRECT_URL / POSTGRES_URL",
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log("Connected to database");

  try {
    for (const migration of MIGRATIONS) {
      const full = path.resolve(process.cwd(), migration);
      if (!fs.existsSync(full)) {
        console.error(`Migration not found: ${migration}`);
        process.exit(1);
      }
      const sql = fs.readFileSync(full, "utf8");
      console.log(`Applying ${migration}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`OK ${migration}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
