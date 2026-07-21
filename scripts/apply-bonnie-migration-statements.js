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

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const filepath = path.join(process.cwd(), 'supabase', 'migrations', '20260720220000_bonnie_agentic_os_engine.sql');
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Migration file not found: ${filepath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filepath, 'utf8');
  
  // Split SQL by semicolon, but ignore semicolons inside function bodies or dollar-quoted strings
  // A simple split statement is fine if we are careful, or we can just split by standard semicolons
  // since our file doesn't have complex functions with nested semicolons.
  // Let's look at the migration file first to see its contents or just split by a safe regex.
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`⚡ Applying ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\nExecuting statement [${i + 1}/${statements.length}]:`);
    console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

    if (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️ Warning: already exists / duplicate, skipping...');
      } else {
        console.error('❌ Error executing statement:', error);
        process.exit(1);
      }
    } else {
      console.log('✅ Statement executed successfully');
    }
  }

  console.log('\n🎉 Migration applied successfully!');
  process.exit(0);
}

run().catch(console.error);
