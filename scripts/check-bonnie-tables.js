const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function getEnv(key) {
  const envFiles = ['.env.local', '.env.production.local', '.env'];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k.trim() === key) return v.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      }
    } catch (e) {}
  }
  return process.env[key];
}

const supabase = createClient(
  getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
);

async function check() {
  const tables = ['bonnie_conversations', 'bonnie_messages', 'bonnie_workflows'];
  console.log('Checking Bonnie Agentic OS tables...\n');
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log(`  ❌ ${t} — does NOT exist`);
    } else if (error) {
      console.log(`  ⚠️  ${t} — error: ${error.message}`);
    } else {
      console.log(`  ✅ ${t} — exists`);
    }
  }

  // Check columns on autonomous_runner_approvals
  console.log('\nChecking autonomous_runner_approvals extra columns...');
  const { data, error } = await supabase
    .from('autonomous_runner_approvals')
    .select('edit_history, workflow_id, conversation_id, source')
    .limit(1);
  if (error) {
    console.log(`  ❌ Extra columns not present: ${error.message}`);
  } else {
    console.log(`  ✅ edit_history, workflow_id, conversation_id, source — all present`);
  }
}

check().catch(console.error);
