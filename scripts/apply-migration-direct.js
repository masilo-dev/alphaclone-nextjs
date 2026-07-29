#!/usr/bin/env node

<<<<<<< HEAD
const fs = require("fs");
const path = require("path");
const https = require("https");

// Load environment variables
const envFiles = [
  ".env.local",
  ".env.production.local",
  ".env",
  ".env.vercel.local",
];
function getEnv(key) {
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
const https = require('https');

// Load environment variables
const envFiles = ['.env.local', '.env.production.local', '.env', '.env.vercel.local'];
function getEnv(key) {
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

<<<<<<< HEAD
const SUPABASE_URL =
  getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
  getEnv("VITE_SUPABASE_URL") ||
  getEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment or env files",
  );
  process.exit(1);
}

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ sql_query: sql });
    const parsed = new URL(SUPABASE_URL);

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: "/rest/v1/rpc/exec_sql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, body });
        } else {
          resolve({ success: false, error: body, statusCode: res.statusCode });
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.write(data);
    req.end();
  });
}

async function run() {
  const migrationFile = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260525000000_create_bonnie_dream_sessions.sql",
  );
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(migrationFile, "utf8");
  console.log("⚡ Connected to Supabase via RPC.");
  console.log(
    "⚡ Applying migration 20260525000000_create_bonnie_dream_sessions.sql...",
  );

  try {
    const result = await executeSql(sqlContent);
    if (result.success) {
      console.log("✅ Migration applied successfully.");
      process.exit(0);
    } else {
      console.error(
        `❌ Failed applying migration (HTTP ${result.statusCode}):`,
        result.error,
      );
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Error executing SQL:", err.message);
    process.exit(1);
  }
=======
const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment or env files');
    process.exit(1);
}

async function executeSql(sql) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ sql_query: sql });
        const parsed = new URL(SUPABASE_URL);

        const options = {
            hostname: parsed.hostname,
            port: 443,
            path: '/rest/v1/rpc/exec_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, body });
                } else {
                    resolve({ success: false, error: body, statusCode: res.statusCode });
                }
            });
        });

        req.on('error', (error) => reject(error));
        req.write(data);
        req.end();
    });
}

async function run() {
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260525000000_create_bonnie_dream_sessions.sql');
    if (!fs.existsSync(migrationFile)) {
        console.error(`❌ Migration file not found: ${migrationFile}`);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    console.log('⚡ Connected to Supabase via RPC.');
    console.log('⚡ Applying migration 20260525000000_create_bonnie_dream_sessions.sql...');
    
    try {
        const result = await executeSql(sqlContent);
        if (result.success) {
            console.log('✅ Migration applied successfully.');
            process.exit(0);
        } else {
            console.error(`❌ Failed applying migration (HTTP ${result.statusCode}):`, result.error);
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Error executing SQL:', err.message);
        process.exit(1);
    }
>>>>>>> origin/main
}

run();
