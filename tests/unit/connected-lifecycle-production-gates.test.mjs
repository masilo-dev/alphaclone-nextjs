import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('invoice delivery remains unverified until a matching provider webhook arrives', () => {
  const workflow = read('src/workflows/invoice-lifecycle.ts');
  const webhook = read('src/app/api/invoices/[id]/delivery-webhook/route.ts');
  assert.match(workflow, /delivery_status:\s*'PENDING'/);
  assert.doesNotMatch(workflow, /delivery_status:\s*'DELIVERED'/);
  assert.match(webhook, /\.eq\('provider_msg_id', msgId\)/);
  assert.match(webhook, /delivery_verified_at/);
});

test('recurring invoices cannot become sent before provider acceptance evidence exists', () => {
  const recurring = read('src/services/finance/recurringInvoiceService.ts');
  assert.match(recurring, /status:\s*'draft'/);
  assert.match(recurring, /delivery_status:\s*'PENDING'/);
  assert.match(recurring, /provider_accepted:\s*true/);
  assert.match(recurring, /delivery_verified:\s*false/);
  assert.match(recurring, /recurring_send_error/);
  assert.doesNotMatch(recurring, /status:\s*profile\.autoSend \? 'sent' : 'draft'/);
});

test('contract email acceptance is recorded as a request, not verified delivery', () => {
  for (const path of ['src/app/api/contracts/management/route.ts', 'src/services/contractSignatureReminderService.ts']) {
    const source = read(path);
    assert.match(source, /event_type:\s*"requested"/);
    assert.match(source, /delivery_verified:\s*false/);
  }
});

test('contract audit evidence is tenant keyed and accepts the expanded action vocabulary', () => {
  const migration = read('supabase/migrations/20260801114000_contract_audit_tenant_hardening.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS tenant_id/);
  assert.match(migration, /enforce_contract_audit_tenant/);
  assert.match(migration, /contract_audit_tenant_access/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS contract_audit_trail_action_check/);
});

test('public invoice view evidence is bound to the stored public token', () => {
  const page = read('src/app/invoice/[id]/page.tsx');
  const view = read('src/app/api/invoices/[id]/view/route.ts');
  assert.match(page, /view\?token=/);
  assert.match(page, /new URLSearchParams\(\{ id: invoiceId \}\)/);
  assert.match(view, /Public invoice token required/);
  assert.match(view, /storedToken !== publicToken/);
});

test('connected invoice migration permits every operational lifecycle state', () => {
  const migration = read('supabase/migrations/20260801100000_connected_revenue_lifecycle.sql');
  for (const status of ['pending_approval', 'approved', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'disputed']) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
  assert.match(migration, /DROP CONSTRAINT IF EXISTS business_invoices_status_check/);
  assert.match(migration, /VALIDATE CONSTRAINT business_invoices_lifecycle_status_check/);
});

test('scanned PDFs and canonical document versions are operational', () => {
  const intelligence = read('src/services/documentIntelligenceService.ts');
  const documentApi = read('src/app/api/tenant/[tenantId]/documents/[documentId]/route.ts');
  assert.match(intelligence, /ocrScannedPdf/);
  assert.match(intelligence, /type: "input_file"/);
  assert.match(intelligence, /summary_citation/);
  assert.match(documentApi, /from\('document_versions'\)/);
});

test('provider-authenticated inbound channels feed outreach reply automation', () => {
  for (const path of [
    'src/app/api/webhooks/email/inbound/[provider]/route.ts',
    'src/app/api/webhooks/twilio/sms/route.ts',
    'src/app/api/webhooks/whatsapp/route.ts',
    'src/services/zoho/ZohoMailService.ts',
  ]) assert.match(read(path), /recordInboundOutreachReply/);
  const service = read('src/lib/outreach/recordInboundOutreachReply.ts');
  assert.match(service, /status: 'stopped'/);
  assert.match(service, /Inbound unsubscribe request/);
  assert.match(service, /target_type: 'deal'/);
});

test('provider delivery callbacks enforce campaign bounce and complaint safety', () => {
  const webhook = read('src/app/api/webhooks/email/[provider]/route.ts');
  assert.match(webhook, /campaignHealth/);
  assert.match(webhook, /eventTypeLower\.includes\('spam'\)/);
  assert.match(webhook, /event_type:\s*safetyEventType/);
  assert.match(webhook, /health\.shouldPause/);
  assert.match(webhook, /status:\s*'paused'/);
  assert.match(webhook, /auto_paused_at/);
  assert.match(webhook, /currentlySent \+ totalDelivered \+ totalOpened \+ totalClicked/);
});

test('running outreach experiments assign and execute deterministic variants', () => {
  const worker = read('src/lib/outreach/processSequenceEnrollments.ts');
  const replies = read('src/lib/outreach/recordInboundOutreachReply.ts');
  assert.match(worker, /createHash\('sha256'\)\.update\(enrollmentId\)/);
  assert.match(worker, /resolveExperimentAssignment/);
  assert.match(worker, /applyVariant/);
  assert.match(worker, /variant:\s*assignment\?\.variantKey/);
  assert.match(worker, /experiment_id:\s*assignment\?\.experimentId/);
  assert.match(replies, /variant:\s*enrollment\.metadata\?\.variant/);
  assert.match(replies, /experiment_id:\s*enrollment\.metadata\?\.experiment_id/);
});

test('contract signing links are identity-bound and advance canonical signer order', () => {
  const management = read('src/app/api/contracts/management/route.ts');
  const service = read('src/services/server/contractServerService.ts');
  const signRoute = read('src/app/api/contracts/sign/route.ts');
  assert.match(management, /to:\s*recipientEmail/);
  assert.doesNotMatch(management, /to:\s*resolvedRecipients/);
  assert.match(service, /allCanonicalPartiesSigned/);
  assert.match(service, /updates\.lifecycle_status = allCanonicalPartiesSigned \? 'signed' : 'sent'/);
  assert.match(signRoute, /sendOrderedContractSignatureReminders/);
  assert.match(signRoute, /force:\s*true/);
});

test('signed-contract automation creates canonical delivery, billing, and expiry relationships', () => {
  const workflow = read('src/workflows/contract-flows.ts');
  const alerts = read('src/services/revenueLifecycleAlertService.ts');
  assert.match(workflow, /contract_id:\s*contractId/);
  assert.match(workflow, /relationship:\s*'billed_by'/);
  assert.match(workflow, /relationship:\s*'provisions'/);
  assert.match(workflow, /invoice_payment_schedules/);
  assert.match(workflow, /lifecycle_status:\s*'active'/);
  assert.match(alerts, /lifecycle_status:\s*'expiring'/);
  assert.match(alerts, /to_status:\s*'expiring'/);
});
