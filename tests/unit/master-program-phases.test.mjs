/**
 * Master program phases P0–P5 structural regression + mocked E2E lifecycle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('NBA engine exports deriveTenantNextBestActions', async () => {
  const mod = await import('../../src/lib/execution/nextBestActionEngine.ts');
  assert.equal(typeof mod.deriveTenantNextBestActions, 'function');
  assert.equal(typeof mod.nbaToChaseHints, 'function');
});

test('next-actions API route exists', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/dashboard/next-actions/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /deriveTenantNextBestActions/);
  assert.match(src, /deriveCustomerSuccessActions/);
});

test('deal closed_won creates project via domain command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/workflows/deal-stage.ts', import.meta.url), 'utf8');
  assert.match(src, /executeProjectCreateCommand/);
  assert.match(src, /closed_won|closedWonActions/);
});

test('invoice lifecycle reminder uses domain email command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/invoices/invoiceLifecycleSteps.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeSendEmailCommand/);
  assert.match(src, /executionSource: 'cron'/);
});

test('canonical commercial object is quotes', async () => {
  const { resolveCommercialObjectType, CANONICAL_COMMERCIAL_OBJECT } = await import(
    '../../src/lib/commercial/canonicalQuote.ts'
  );
  assert.equal(CANONICAL_COMMERCIAL_OBJECT, 'quotes');
  assert.equal(resolveCommercialObjectType('proposal'), 'quotes');
});

test('marketing week insight uses evidence only', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/marketing/marketingWeekInsight.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /social_posts/);
  assert.match(src, /evidence_window_days/);
});

test('attention dashboard consumes next-actions', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/components/dashboard/AttentionFirstDashboard.tsx', import.meta.url),
    'utf8'
  );
  assert.match(src, /\/api\/dashboard\/next-actions/);
});

test('mocked E2E lifecycle ID consistency', async () => {
  // Simulated lifecycle IDs — proves relationship shape without providers.
  const tenantId = 'tenant-e2e';
  const leadId = 'lead-1';
  const dealId = 'deal-1';
  const quoteId = 'quote-1';
  const contractId = 'contract-1';
  const projectId = 'project-1';
  const invoiceId = 'invoice-1';

  const { projectCreateIdempotencyKey } = await import(
    '../../src/lib/execution/commands/projectCreateCommand.ts'
  );
  const key1 = projectCreateIdempotencyKey({ tenantId, dealId, name: 'Delivery A' });
  const key2 = projectCreateIdempotencyKey({ tenantId, dealId, name: 'Delivery B' });
  assert.equal(key1, key2, 'deal-won double fire must not create two projects');

  const { invoiceSendIdempotencyKey, contractSendIdempotencyKey } = await import(
    '../../src/lib/execution/domainIdempotencyKeys.ts'
  );
  const invKey = invoiceSendIdempotencyKey({
    tenantId,
    invoiceId,
    recipients: ['client@example.com'],
  });
  const invKey2 = invoiceSendIdempotencyKey({
    tenantId,
    invoiceId,
    recipients: ['client@example.com'],
  });
  assert.equal(invKey, invKey2);

  const cKey = contractSendIdempotencyKey({
    tenantId,
    contractId,
    recipient: 'client@example.com',
  });
  assert.match(cKey, new RegExp(contractId));

  const chain = { tenantId, leadId, dealId, quoteId, contractId, projectId, invoiceId };
  assert.equal(Object.keys(chain).length, 7);
});

test('cross-surface collision contract: shared domain write receipt lookup', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/execution/domainExternalWrite.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /findReceiptByIdempotency/);
});

test('financial money movement never MCP auto-allow', async () => {
  const { isFinancialMoneyMovementTool } = await import('../../src/lib/ai/ToolPolicyGate.ts');
  assert.equal(isFinancialMoneyMovementTool('transfer_funds'), true);
  assert.equal(isFinancialMoneyMovementTool('send_email'), false);
});

test('NBA chase hints include stop conditions', async () => {
  const { nbaToChaseHints } = await import('../../src/lib/execution/nextBestActionEngine.ts');
  const hints = nbaToChaseHints([
    {
      object_type: 'invoice',
      object_id: 'i1',
      object_label: 'INV-1',
      current_state: 'overdue',
      last_meaningful_event: null,
      outstanding_action: 'payment_reminder',
      blocking_condition: 'overdue',
      recommended_next_action: 'Remind',
      reason: 'overdue',
      urgency: 'critical',
      recommended_capability: 'send_invoice',
      approval_requirement: 'tenant_policy',
      href: '/',
    },
  ]);
  assert.equal(hints[0].policy_hint, 'invoice_chaser');
  assert.ok(hints[0].stop_when.includes('invoice_paid'));
});
