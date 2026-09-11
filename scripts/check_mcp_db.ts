console.log('--- DB Diagnostic Script Initializing ---');
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });

import { createClient } from '@supabase/supabase-js';
import { ENV } from './src/config/env';

async function checkDatabase() {
  console.log('--- MCP Database Diagnostic ---');
  
  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase environment variables.');
    return;
  }

  const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  const tables = [
    'mcp_oauth_clients',
    'mcp_oauth_codes',
    'mcp_oauth_tokens',
    'mcp_api_keys',
    'mcp_sessions'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true });

      if (error) {
        console.error(`[-] Table ${table}: FAILED (${error.message})`);
      } else {
        console.log(`[+] Table ${table}: OK`);
      }
    } catch (err) {
      console.error(`[!] Table ${table}: ERROR`, err);
    }
  }

  // Check if Claude is registered
  console.log('\n--- Client Registration Check ---');
  const { data: clients, error: clientError } = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, client_name')
    .eq('client_id', '1778309945386-41bab8272f61');

  if (clientError) {
    console.error(`[-] Claude Client Check: FAILED (${clientError.message})`);
  } else if (clients && clients.length > 0) {
    console.log(`[+] Claude Client Found: ${clients[0].client_name}`);
  } else {
    console.warn(`[!] Claude Client NOT FOUND`);
  }
}

checkDatabase().catch(console.error);
