<<<<<<< HEAD
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

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
      const lines = content.split("\n");
      for (const line of lines) {
        const [k, ...v] = line.split("=");
        if (k.trim() === key)
          return v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
=======
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function getEnv(key) {
  const envFiles = ['.env.local', '.env.production.local', '.env', '.env.vercel.local'];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k.trim() === key) return v.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
>>>>>>> origin/main
      }
    } catch (e) {}
  }
  return process.env[key];
}

async function runMigration() {
<<<<<<< HEAD
  const dbUrl =
    getEnv("DATABASE_URL") || getEnv("SUPABASE_DB_URL") || getEnv("DIRECT_URL");

  if (!dbUrl) {
    console.error("Missing DATABASE_URL or SUPABASE_DB_URL.");
    return;
  }

  console.log("Connecting to database...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
=======
  const dbUrl = getEnv('DATABASE_URL') || getEnv('SUPABASE_DB_URL') || getEnv('DIRECT_URL');
  
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or SUPABASE_DB_URL.');
    return;
  }

  console.log('Connecting to database...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
>>>>>>> origin/main
  });

  try {
    await client.connect();
<<<<<<< HEAD
    console.log("Connected!");

    const migrationFile =
      "supabase/migrations/20260509140000_create_mcp_missing_tables.sql";
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), migrationFile),
      "utf8",
    );

    console.log(`Executing migration: ${migrationFile}`);
    await client.query(sql);
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    if (err.hint) console.error("Hint:", err.hint);
=======
    console.log('Connected!');

    const migrationFile = 'supabase/migrations/20260509140000_create_mcp_missing_tables.sql';
    const sql = fs.readFileSync(path.resolve(process.cwd(), migrationFile), 'utf8');

    console.log(`Executing migration: ${migrationFile}`);
    await client.query(sql);
    console.log('Migration applied successfully!');

  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
>>>>>>> origin/main
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
