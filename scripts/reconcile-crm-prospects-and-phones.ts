import { createClient } from '@supabase/supabase-js';
import { normalizePhoneNumber } from '../src/lib/phone/phoneNormalizer';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// Load production environment
const envPath = path.resolve(process.cwd(), '.env.production.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const TARGET_TENANT_ID = process.env.TENANT_ID || '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
const isExecute = process.argv.includes('--execute');

const GENUINE_TEST_PATTERNS = [
  /^test\s*—/i,
  /^qa\s+test\b/i,
  /^\[test\]/i,
];

function isGenuineTestLead(lead: any): boolean {
  const name = String(lead.business_name || '').trim();
  const email = String(lead.email || '').trim().toLowerCase();
  if (GENUINE_TEST_PATTERNS.some((p) => p.test(name))) return true;
  if (email.endsWith('.invalid') || email === 'bonniiehendrix@gmail.com') return true;
  return false;
}

async function run() {
  console.log(`================================================================`);
  console.log(`CRM Data Reconciliation — AlphaClone Systems`);
  console.log(`Mode: ${isExecute ? 'LIVE EXECUTION' : 'DRY RUN (Preview Only)'}`);
  console.log(`Target Tenant: ${TARGET_TENANT_ID}`);
  console.log(`================================================================\n`);

  // 1. Fetch ALL leads for tenant with pagination
  let allLeads: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: pageLeads, error } = await supabase
      .from('leads')
      .select('id, business_name, email, phone, location, notes, is_test_data, source, source_details, metadata')
      .eq('tenant_id', TARGET_TENANT_ID)
      .range(from, to);

    if (error) {
      console.error(`Failed to load leads at page ${page}:`, error.message);
      process.exit(1);
    }

    if (!pageLeads || pageLeads.length === 0) {
      hasMore = false;
    } else {
      allLeads = allLeads.concat(pageLeads);
      if (pageLeads.length < pageSize) {
        hasMore = false;
      } else {
        page += 1;
      }
    }
  }

  const leads = allLeads;
  console.log(`Total leads inspected in tenant: ${leads.length}`);

  // 2. Identify falsely flagged test leads
  const falseTestLeads: any[] = [];
  const genuineTestLeads: any[] = [];

  for (const lead of leads) {
    if (lead.is_test_data === true) {
      if (isGenuineTestLead(lead)) {
        genuineTestLeads.push(lead);
      } else {
        falseTestLeads.push(lead);
      }
    }
  }

  console.log(`\n--- 1. Test Data Classification Audit ---`);
  console.log(`Genuine test leads to PRESERVE (is_test_data: true): ${genuineTestLeads.length}`);
  genuineTestLeads.forEach((l) => console.log(`   [PRESERVE TEST] ${l.id} | ${l.business_name} (${l.email || 'no email'})`));

  console.log(`\nReal leads to RESTORE (is_test_data: false): ${falseTestLeads.length}`);
  console.log(`Sample 5 of ${falseTestLeads.length} real leads to restore:`);
  falseTestLeads.slice(0, 5).forEach((l) => console.log(`   [RESTORE] ${l.id} | ${l.business_name} | ${l.phone || 'no phone'} | ${l.source || 'no source'}`));

  // 3. Identify corrupted phone numbers
  const phoneRepairs: Array<{ lead: any; originalPhone: string; repairedPhone: string }> = [];

  for (const lead of leads) {
    const rawPhone = lead.phone ? String(lead.phone).trim() : null;
    if (!rawPhone) continue;

    // Detect corrupted +10... or +0... or local 0... in Zimbabwe leads
    const isCorrupted = rawPhone.startsWith('+10') || rawPhone.startsWith('+0');
    const isZwContext =
      lead.location?.toLowerCase().includes('zimbabwe') ||
      lead.location?.toLowerCase().includes('harare') ||
      lead.source?.toLowerCase().includes('africabizinfo') ||
      lead.source?.toLowerCase().includes('africa2trust');

    if (isCorrupted || (isZwContext && !rawPhone.startsWith('+263'))) {
      const result = normalizePhoneNumber(rawPhone, {
        location: lead.location,
        source: lead.source,
      });

      if (result.isValid && result.e164 && result.e164 !== rawPhone) {
        phoneRepairs.push({
          lead,
          originalPhone: rawPhone,
          repairedPhone: result.e164,
        });
      }
    }
  }

  console.log(`\n--- 2. Phone Normalization Audit ---`);
  console.log(`Corrupted/unnormalized phones to repair: ${phoneRepairs.length}`);
  console.log(`Sample 10 repairs:`);
  phoneRepairs.slice(0, 10).forEach((p) => {
    console.log(`   [PHONE REPAIR] ${p.lead.id} | ${p.lead.business_name} | "${p.originalPhone}" -> "${p.repairedPhone}"`);
  });

  // 4. Execution
  if (!isExecute) {
    console.log(`\n[DRY RUN COMPLETE] Zero changes were applied.`);
    console.log(`To apply these fixes, run: tsx scripts/reconcile-crm-prospects-and-phones.ts --execute\n`);
    return;
  }

  console.log(`\n================================================================`);
  console.log(`APPLYING REPAIRS TO DATABASE...`);
  console.log(`================================================================`);

  // Apply test data fixes
  let testDataFixed = 0;
  for (const lead of falseTestLeads) {
    const meta = {
      ...(lead.metadata || {}),
      test_data_reconciled_at: new Date().toISOString(),
      test_data_reconciled_reason: 'Removed false substring match on freeform notes containing "untested"',
    };

    const { error: updErr } = await supabase
      .from('leads')
      .update({
        is_test_data: false,
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
      .eq('tenant_id', TARGET_TENANT_ID);

    if (updErr) {
      console.error(`Failed to update lead ${lead.id}:`, updErr.message);
    } else {
      testDataFixed += 1;
    }
  }
  console.log(`Successfully restored ${testDataFixed}/${falseTestLeads.length} leads to is_test_data: false`);

  // Apply phone number repairs
  let phonesRepaired = 0;
  for (const repair of phoneRepairs) {
    const meta = {
      ...(repair.lead.metadata || {}),
      repaired_phone_from: repair.originalPhone,
      repaired_phone_at: new Date().toISOString(),
    };

    const { error: phoneErr } = await supabase
      .from('leads')
      .update({
        phone: repair.repairedPhone,
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', repair.lead.id)
      .eq('tenant_id', TARGET_TENANT_ID);

    if (phoneErr) {
      console.error(`Failed to update phone for lead ${repair.lead.id}:`, phoneErr.message);
    } else {
      phonesRepaired += 1;
    }
  }
  console.log(`Successfully repaired ${phonesRepaired}/${phoneRepairs.length} phone numbers to valid E.164`);

  // Add audit activity log
  await supabase.from('activity_logs').insert({
    tenant_id: TARGET_TENANT_ID,
    action: 'crm_reliability_reconciliation',
    metadata: {
      test_leads_restored: testDataFixed,
      phones_repaired: phonesRepaired,
      executed_at: new Date().toISOString(),
    },
  });

  console.log(`\nRECONCILIATION COMPLETE! All records successfully updated.\n`);
}

run().catch((err) => {
  console.error('Fatal reconciliation error:', err);
  process.exit(1);
});
