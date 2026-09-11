/**
 * Finance integrity integration checks (RPC + journal assertions).
 * Run: node tests/finance-integrity.integration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function getEnv(key) {
  for (const file of ['.env.local', '.env.production.local', '.env']) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k.trim() === key) return v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      /* ignore */
    }
  }
  return process.env[key];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  assert(url && key, 'Supabase env vars required for finance integrity test');

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const tenantId = process.env.FINANCE_E2E_TENANT_ID || '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
  const total = 500;

  const { data: client } = await admin.from('business_clients').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
  assert(client?.id, 'Need at least one business client');

  await admin.rpc('create_default_chart_of_accounts', { p_tenant_id: tenantId });

  const { data: invoice, error: createError } = await admin
    .from('business_invoices')
    .insert({
      tenant_id: tenantId,
      client_id: client.id,
      invoice_number: `INT-${Date.now()}`,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'sent',
      subtotal: total,
      tax: 0,
      tax_rate: 0,
      discount_amount: 0,
      total,
      amount_paid: 0,
      currency: 'USD',
      currency_code: 'USD',
      is_public: false,
    })
    .select('id')
    .single();
  assert(!createError && invoice?.id, createError?.message || 'Invoice create failed');

  const { data: issueResult, error: issueError } = await admin.rpc('post_business_invoice_issue_journal', {
    p_tenant_id: tenantId,
    p_invoice_id: invoice.id,
    p_actor_user_id: null,
  });
  assert(!issueError, issueError?.message || 'Issue journal RPC failed');

  const issuePosted = Array.isArray(issueResult) ? issueResult[0]?.posted : issueResult?.posted;
  assert(issuePosted, 'Issue journal RPC returned posted=false — COA or trigger misconfigured');
  if (issuePosted) {
    const { data: issueEntry } = await admin
      .from('journal_entries')
      .select('id, source_type, total_debits, total_credits')
      .eq('tenant_id', tenantId)
      .eq('source_type', 'invoice_issue')
      .eq('source_id', invoice.id)
      .maybeSingle();
    assert(issueEntry, 'Issue journal entry missing');
    assert(Number(issueEntry.total_debits) === total, 'Issue journal debit mismatch');
    assert(Number(issueEntry.total_credits) === total, 'Issue journal credit mismatch');

    const { data: lines } = await admin
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, chart_of_accounts(account_code)')
      .eq('entry_id', issueEntry.id);
    const codes = (lines || []).map((line) => line.chart_of_accounts?.account_code).filter(Boolean);
    assert(codes.includes('1100') || codes.includes('1200'), 'AR line missing on issue journal');
  }

  const paymentKey = randomUUID();
  const { data: paidRows, error: payError } = await admin.rpc('record_business_invoice_payment', {
    p_tenant_id: tenantId,
    p_invoice_id: invoice.id,
    p_amount: total,
    p_idempotency_key: paymentKey,
    p_source: 'manual',
    p_external_reference: `INT-${invoice.id.slice(0, 8)}`,
    p_actor_user_id: null,
  });
  assert(!payError, payError?.message || 'Payment RPC failed');
  const paid = Array.isArray(paidRows) ? paidRows[0] : paidRows;
  assert(paid?.status === 'paid', 'Invoice not marked paid');

  const { data: paymentEntry } = await admin
    .from('journal_entries')
    .select('id, total_debits, total_credits')
    .eq('tenant_id', tenantId)
    .eq('source_type', 'invoice_payment')
    .eq('reference', `INT-${invoice.id.slice(0, 8)}`)
    .maybeSingle();

  if (paymentEntry) {
    assert(Number(paymentEntry.total_debits) === total, 'Payment journal debit mismatch');
    const { data: payLines } = await admin
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, chart_of_accounts(account_code)')
      .eq('entry_id', paymentEntry.id);
    const payCodes = (payLines || []).map((line) => line.chart_of_accounts?.account_code).filter(Boolean);
    assert(payCodes.includes('1000'), 'Cash line missing on payment journal');
    assert(payCodes.includes('1100') || payCodes.includes('1200'), 'AR credit missing on payment journal');
  }

  console.log('finance-integrity.integration: PASS');
}

main().catch((error) => {
  console.error('finance-integrity.integration: FAIL', error.message || error);
  process.exit(1);
});
