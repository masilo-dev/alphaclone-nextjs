import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('invoiceLifecycleSteps uses admin client and stores PDF metadata without PGRST204 column crash', () => {
  const src = read('src/lib/invoices/invoiceLifecycleSteps.ts');
  assert.match(src, /createSupabaseAdminClient\(\)/, 'must use createSupabaseAdminClient for worker/background safety');
  assert.match(src, /pdf_storage_path:\s*storagePath/, 'must store pdf_storage_path inside metadata');
  assert.doesNotMatch(
    src,
    /\.remove\(\[storagePath\]\)/,
    'must not delete the uploaded PDF on metadata update fallback'
  );
  assert.match(src, /export type InvoiceAttachmentItem/, 'must export InvoiceAttachmentItem');
  assert.match(
    src,
    /path\.startsWith\(`tenant\/\$\{input\.tenantId\}\/`\)/,
    'must enforce tenant storage prefix on additional attachments'
  );
  assert.match(
    src,
    /from\('invoice_delivery_log'\)\.insert/,
    'must log email dispatch in invoice_delivery_log'
  );
  assert.match(
    src,
    /canonical_delivery_status:\s*'sent'/,
    'markInvoiceSentPhase must record canonical_delivery_status = sent in compliance with DB check constraint'
  );
  assert.match(
    src,
    /email_delivery_status:\s*'provider_accepted'/,
    'markInvoiceSentPhase must record email_delivery_status = provider_accepted in metadata'
  );
});

test('durableInvoiceRouter executes invoice send inline and surfaces real errors', () => {
  const routerSrc = read('src/lib/invoices/durableInvoiceRouter.ts');
  assert.match(
    routerSrc,
    /executeEnqueuedInvoiceSendInline/,
    'queueInvoiceSend must execute inline and return truthful status'
  );
  assert.match(
    routerSrc,
    /canonical_delivery_status:\s*'provider_accepted'/,
    'must return canonical_delivery_status provider_accepted when inline execution succeeds'
  );

  const taskSrc = read('src/lib/invoices/durableInvoiceSendTask.ts');
  assert.match(
    taskSrc,
    /function formatExecutionError/,
    'durableInvoiceSendTask must extract PostgrestError / object messages instead of masking as invoice_send_failed'
  );
});

test('executeDomainExternalWrite does not replay unverified queued stub receipts for send_invoice', () => {
  const src = read('src/lib/execution/domainExternalWrite.ts');
  assert.match(
    src,
    /params\.capability === 'send_invoice'/,
    'domainExternalWrite must check send_invoice receipts before replaying queued stubs'
  );
  assert.match(
    src,
    /existingOutput\?\.status === 'queued'/,
    'must bypass idempotency replay when previous receipt was only queued without email_id'
  );
});

test('ZohoMailService attachment binary upload uses application/octet-stream to avoid HTTP 415', () => {
  const src = read('src/services/zoho/ZohoMailService.ts');
  assert.match(
    src,
    /'Content-Type':\s*'application\/octet-stream'/,
    'Zoho raw binary upload fallback must use application/octet-stream'
  );
});

test('invoice API routes support client_name, client_email, attachments, and resending', () => {
  const createRoute = read('src/app/api/invoices/route.ts');
  assert.match(createRoute, /client_email/, 'POST /api/invoices must persist client_email');
  assert.match(createRoute, /attachments/, 'POST /api/invoices must persist attachments');

  const patchRoute = read('src/app/api/invoices/[id]/route.ts');
  assert.match(
    patchRoute,
    /Math\.abs\(Number\(updatePayload\.total\)\s*-\s*Number\(existing\.total \|\| 0\)\)\s*>\s*0\.009/,
    'PATCH /api/invoices/[id] must compare numeric deltas before rejecting locked invoice updates'
  );

  const lifecycleRoute = read('src/app/api/invoices/lifecycle/route.ts');
  assert.match(
    lifecycleRoute,
    /\['paid',\s*'void',\s*'cancelled'\]/,
    'POST /api/invoices/lifecycle must only block paid/void/cancelled and allow sending/resending active invoices'
  );

  const attachmentsRoute = read('src/app/api/invoices/[id]/attachments/route.ts');
  assert.match(attachmentsRoute, /export async function POST/, 'must provide POST attachment upload endpoint');
  assert.match(attachmentsRoute, /export async function DELETE/, 'must provide DELETE attachment endpoint');
});

test('MCP invoice tools route through queueInvoiceSend and return truthful delivery fields', () => {
  const mcpInvoicing = read('src/lib/mcp/tools/invoicing.ts');
  assert.match(mcpInvoicing, /canonical_delivery_status/, 'MCP invoicing tools must return canonical_delivery_status');
  const mcpServer = read('src/services/mcp/MCPServer.ts');
  assert.match(mcpServer, /queueInvoiceSend/, 'MCPServer send_invoice must route through queueInvoiceSend');
});

test('Dashboard invoice modals and billing page support recipient selection, attachments, and dual status badges', () => {
  const createModal = read('src/components/dashboard/EnhancedCreateInvoiceModal.tsx');
  assert.match(createModal, /handleRemoveAttachment/, 'Create modal must support managing attachments');
  assert.match(createModal, /Save Draft/, 'Create modal must allow saving as draft');
  assert.match(createModal, /Send Invoice/, 'Create modal must allow sending invoice');

  const editModal = read('src/components/dashboard/EnhancedInvoiceModal.tsx');
  assert.match(editModal, /handleAttachmentUpload/, 'Edit/Finalize modal must support uploading attachments');
  assert.match(editModal, /startInvoiceLifecycleFromDashboard/, 'Edit/Finalize modal must trigger durable lifecycle');

  const billingPage = read('src/components/dashboard/business/EnhancedBillingPage.tsx');
  assert.match(billingPage, /getDeliveryStatusBadge/, 'Billing page must display separate email delivery status badge');
});
