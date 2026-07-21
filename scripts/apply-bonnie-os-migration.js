#!/usr/bin/env node

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
      }
    } catch (e) {}
  }
  return process.env[key];
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment or env files');
    process.exit(1);
}

async function requestRpc(rpcPath, payload) {
    return new Promise((resolve) => {
        const data = JSON.stringify(payload);
        const byteLength = Buffer.byteLength(data, 'utf8');
        const parsed = new URL(SUPABASE_URL);

        const options = {
            hostname: parsed.hostname,
            port: 443,
            path: rpcPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': byteLength,
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ success: res.statusCode >= 200 && res.statusCode < 300, body, statusCode: res.statusCode });
            });
        });

        req.on('error', (error) => resolve({ success: false, error: error.message }));
        req.write(data);
        req.end();
    });
}

async function run() {
    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260720220000_bonnie_agentic_os_engine.sql');
    if (!fs.existsSync(migrationFile)) {
        console.error(`❌ Migration file not found: ${migrationFile}`);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    console.log('⚡ Connected to Supabase via RPC.');
    
    // Attempt 1: exec_sql with { sql: sqlContent }
    console.log('⚡ Attempting exec_sql with { sql: ... }');
    let res = await requestRpc('/rest/v1/rpc/exec_sql', { sql: sqlContent });
    if (res.success) {
        console.log('✅ Migration applied successfully via exec_sql { sql }!');
        process.exit(0);
    }
    console.log(`❌ Failed: HTTP ${res.statusCode} - ${res.body}`);

    process.exit(1);
}

run();
