import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { reconcileOrphanEmails } from '../src/lib/email/reconcileOrphanEmails';

dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or Service Role Key in environment');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log('=== RUNNING ORPHAN EMAIL RECONCILIATION ===');
  const result = await reconcileOrphanEmails(supabase, { batchSize: 200, maxBatches: 50 });
  console.log('Reconciliation completed:');
  console.log(`- Scanned Recipients: ${result.totalScanned}`);
  console.log(`- Updated Messages: ${result.updatedMessages}`);
  console.log(`- Matched Leads: ${result.matchedLeads}`);
  console.log(`- Matched Contacts: ${result.matchedContacts}`);
  console.log(`- Matched Clients: ${result.matchedClients}`);
  if (result.errors.length > 0) {
    console.warn(`- Encountered ${result.errors.length} errors:`, result.errors.slice(0, 5));
  }
}

main().catch(err => {
  console.error('Fatal error during email reconciliation:', err);
  process.exit(1);
});
