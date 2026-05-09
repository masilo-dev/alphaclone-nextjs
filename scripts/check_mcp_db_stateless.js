const fs = require('fs');
const path = require('path');

function getEnv(key) {
  const envFiles = ['.env.local', '.env.production.local', '.env'];
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

async function checkDatabase() {
  console.log('--- MCP Database Diagnostic (Stateless) ---');
  
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    console.error('Missing Supabase environment variables.');
    return;
  }

  const tables = [
    'mcp_oauth_clients',
    'mcp_oauth_codes',
    'mcp_oauth_tokens',
    'mcp_api_keys',
    'mcp_sessions'
  ];

  for (const table of tables) {
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=count`, {
        method: 'HEAD',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Prefer': 'count=exact'
        }
      });

      if (response.ok) {
        const count = response.headers.get('content-range')?.split('/')?.[1] || '0';
        console.log(`[+] Table ${table}: OK (${count} rows)`);
      } else {
        const err = await response.text();
        console.error(`[-] Table ${table}: FAILED (${response.status} ${response.statusText})`);
        if (response.status === 404) {
           console.warn(`    Table likely DOES NOT EXIST.`);
        }
      }
    } catch (err) {
      console.error(`[!] Table ${table}: ERROR`, err.message);
    }
  }

  // Check Claude
  const claudeId = '1778309945386-41bab8272f61';
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/mcp_oauth_clients?client_id=eq.${claudeId}&select=client_name`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    if (data.length > 0) {
      console.log(`[+] Claude Client Found: ${data[0].client_name}`);
    } else {
      console.warn(`[!] Claude Client NOT FOUND in DB.`);
    }
  }
}

checkDatabase().catch(console.error);
