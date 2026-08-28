#!/usr/bin/env node
/**
 * Finance invoice E2E harness (service role).
 * Flow: create draft → mark sent → issue journal → client confirms → record payment → verify GL + AR.
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
        if (k.trim() === key) {
          return v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* ignore */
    }
  }
  return process.env[key];
}

const TENANT_ID = process.env.FINANCE_E2E_TENANT_ID || '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
const TOTAL = 1150;

async function main() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const invoiceNumber = `E2E-${Date.now()}`;
  const subtotal = 1000;
  const tax = 150;

  const { data: client } = await admin
    .from('business_clients')
    .select('id,email,name')
    .eq('tenant_id', TENANT_ID)
    .limit(1)
    .maybeSingle();
  if (!client) throw new Error('No business client found for tenant');

  await admin.rpc('create_default_chart_of_accounts', { p_tenant_id: TENANT_ID });

  const { data: draft, error: createError } = await admin
    .from('business_invoices')
    .insert({
      tenant_id: TENANT_ID,
      client_id: client.id,
      invoice_number: invoiceNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: 'draft',
      subtotal,
      tax_rate: 15,
      tax,
      discount_amount: 0,
      total: TOTAL,
      amount_paid: 0,
      currency: 'USD',
      currency_code: 'USD',
      is_public: false,
      notes: 'Finance E2E harness invoice',
    })
    .select('id')
    .single();
  if (createError) throw createError;

  const invoiceId = draft.id;
  console.log('✓ Created draft invoice', invoiceId, invoiceNumber);

  const sentAt = new Date().toISOString();
  const publicToken = randomUUID();
  const { error: sendError } = await admin
    .from('business_invoices')
    .update({
      status: 'sent',
      lifecycle_status: 'sent',
      sent_at: sentAt,
      is_public: true,
      metadata: { public_token: publicToken },
      updated_at: sentAt,
    })
    .eq('id', invoiceId)
    .eq('tenant_id', TENANT_ID);
  if (sendError) throw sendError;
  console.log('✓ Marked invoice sent');

  const { data: issueRows, error: issueError } = await admin.rpc('post_business_invoice_issue_journal', {
    p_tenant_id: TENANT_ID,
    p_invoice_id: invoiceId,
    p_actor_user_id: null,
  });
  if (issueError) throw issueError;
  const issuePosted = Array.isArray(issueRows) ? issueRows[0]?.posted : issueRows?.posted;
  if (!issuePosted) throw new Error('Issue journal did not post — check COA and fingerprint trigger');
  console.log('✓ Issue journal posted (AR Dr / Revenue Cr)');

  await admin
    .from('business_invoices')
    .update({
      metadata: {
        public_token: publicToken,
        payment_pending_confirmation: true,
        payment_confirmation: {
          reference: `E2E-REF-${Date.now()}`,
          payerName: client.name || 'Client',
          submittedAt: new Date().toISOString(),
        },
      },
    })
    .eq('id', invoiceId);
  console.log('✓ Client payment confirmation recorded');

  const idempotencyKey = `e2e:${invoiceId}:${Date.now()}`;
  const { data: paidRows, error: payError } = await admin.rpc('record_business_invoice_payment', {
    p_tenant_id: TENANT_ID,
    p_invoice_id: invoiceId,
    p_amount: TOTAL,
    p_idempotency_key: idempotencyKey,
    p_source: 'bank_transfer',
    p_external_reference: `E2E-REF-${invoiceId.slice(0, 8)}`,
    p_actor_user_id: null,
  });
  if (payError) throw payError;
  const paidInvoice = Array.isArray(paidRows) ? paidRows[0] : paidRows;
  if (paidInvoice?.status !== 'paid') throw new Error(`Expected paid status, got ${paidInvoice?.status}`);
  console.log('✓ Payment recorded via RPC, status=paid');

  const { data: issueJournal } = await admin
    .from('journal_entries')
    .select('id, source_type, total_debits, total_credits')
    .eq('tenant_id', TENANT_ID)
    .eq('source_type', 'invoice_issue')
    .eq('source_id', invoiceId)
    .maybeSingle();

  const { data: payJournal } = await admin
    .from('journal_entries')
    .select('id, source_type, total_debits, total_credits')
    .eq('tenant_id', TENANT_ID)
    .eq('source_type', 'invoice_payment')
    .eq('reference', `E2E-REF-${invoiceId.slice(0, 8)}`)
    .maybeSingle();

  const { data: openInvoices } = await admin
    .from('business_invoices')
    .select('id,total,amount_paid,status')
    .eq('tenant_id', TENANT_ID)
    .eq('id', invoiceId)
    .maybeSingle();

  const remaining = Math.max(0, Number(openInvoices?.total || 0) - Number(openInvoices?.amount_paid || 0));

  console.log('\n--- Verification ---');
  console.log('Issue journal:', issueJournal || 'none');
  console.log('Payment journal:', payJournal || 'none');
  console.log('Remaining balance:', remaining);
  console.log('Aging bucket would exclude this invoice:', remaining === 0);

  if (remaining !== 0) {
    throw new Error('Aging verification failed: remaining balance should be 0');
  }

  console.log('\n✅ Finance E2E pass complete for', invoiceNumber);
}

main().catch((error) => {
  console.error('\n❌ Finance E2E failed:', error.message || error);
  process.exit(1);
});
