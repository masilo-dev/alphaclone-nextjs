const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const databaseUrl = "postgresql://postgres.ehekzoioqvtweugemktn:Amgseries%40gmail.com@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";

  console.log('Connecting to database via pooler...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected.');

  const migrationPath = path.join(__dirname, '../supabase/migrations/20260602121000_database_repair.sql');
  console.log(`Reading migration from ${migrationPath}...`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log('Applying migration...');
    await client.query(sql);
    console.log('Migration 20260602121000_database_repair.sql applied successfully!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
