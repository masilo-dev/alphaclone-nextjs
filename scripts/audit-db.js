import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkDatabase() {
  console.log('--- Database Audit ---');
  
  // Check tables
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
    
  if (tableError) {
    console.error('Error listing tables:', tableError);
  } else {
    console.log('Tables found:', tables.map(t => t.table_name).join(', '));
  }
  
  // Check quota_usage schema
  const { data: qUsageSchema, error: qUsageError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'quota_usage');
    
  if (qUsageError) {
    console.error('Error getting quota_usage schema:', qUsageError);
  } else {
    console.log('quota_usage columns:', qUsageSchema.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }

  // Check RLS policies for quota_usage
  const { data: policies, error: policyError } = await supabase
    .rpc('get_policies', { table_name: 'quota_usage' });
    
  if (policyError) {
    // If RPC doesn't exist, try direct query
    const { data: directPolicies, error: directError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'quota_usage');
      
    if (directError) {
       console.error('Error getting policies:', directError);
    } else {
       console.log('quota_usage policies:', directPolicies);
    }
  } else {
    console.log('quota_usage policies:', policies);
  }
}

checkDatabase();
