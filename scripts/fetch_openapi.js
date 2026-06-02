const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

async function run() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  console.log(`Fetching OpenAPI spec from ${url}...`);
  try {
    const response = await axios.get(`${url}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    const paths = Object.keys(response.data.paths || {});
    const rpcs = paths.filter(p => p.startsWith('/rpc/'));
    console.log('Exposed RPCs:');
    for (const rpc of rpcs) {
      console.log(`  - ${rpc}`);
    }
  } catch (error) {
    console.error('Error fetching OpenAPI spec:', error.message);
  }
}

run().catch(console.error);
