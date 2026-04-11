
import { createSupabaseAdminClient } from './src/lib/supabase-admin';

async function checkTables() {
  const supabase = createSupabaseAdminClient();
  const tables = ['companies', 'contacts', 'opportunities', 'activities', 'unified_messages'];
  
  console.log('Checking for tables...');
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log(`❌ Table ${table} does NOT exist`);
      } else {
        console.log(`❓ Error checking table ${table}:`, error.message);
      }
    } else {
      console.log(`✅ Table ${table} EXISTS`);
    }
  }
}

checkTables();
