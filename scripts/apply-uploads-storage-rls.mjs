#!/usr/bin/env node
/**
 * Apply uploads Storage RLS migration.
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

const MIGRATION =
  "supabase/migrations/20260724223000_uploads_storage_tenant_rls.sql";

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
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
