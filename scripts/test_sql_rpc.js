const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function probe() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Common names for running dynamic SQL
  const candidates = [
    'exec_sql', 'execute_sql', 'run_sql', 'sql', 'query',
    'exec_query', 'execute_query', 'run_query', 'eval_sql'
  ];

  for (const name of candidates) {
    try {
      const { data, error } = await supabase.rpc(name, { query: 'SELECT 1 as val' });
      if (error && error.message.includes('does not exist')) {
        // Function not found
        continue;
      }
      console.log(`Candidate '${name}' returned:`, { data, error });
    } catch (e) {
      console.log(`Candidate '${name}' threw:`, e.message);
    }
  }
}

probe().catch(console.error);
