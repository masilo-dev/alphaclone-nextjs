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

async function testQuery() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Let's use the sample ID we saw: '16c23187-01eb-4f69-86c4-34692b8d7f0b'
  const invoiceId = '16c23187-01eb-4f69-86c4-34692b8d7f0b';

  console.log('Testing query from send_invoice:');
  const { data, error } = await supabase
    .from('business_invoices')
    .select(`
        *,
        tenant:tenant_id (
            id,
            name,
            slug
        ),
        client:client_id (
            id,
            name,
            email,
            company,
            phone
        ),
        project:project_id (
            id,
            name
        )
    `)
    .eq('id', invoiceId)
    .single();

  if (error) {
    console.error('Query error:', error.message, error.code, error.details);
  } else {
    console.log('Query success:', data);
  }
}

testQuery().catch(console.error);
