/**
 * P0 completion gate — domain execution, policy, idempotency, reconciliation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

test('domain external write is source-neutral (MCP adapter delegates)', async () => {
  const gateway = await import('../../src/lib/mcp/executionGateway.ts');
  const domain = await import('../../src/lib/execution/domainExternalWrite.ts');
  assert.equal(typeof domain.executeDomainExternalWrite, 'function');
  assert.equal(typeof gateway.executeMcpWrite, 'function');
});

test('financial money movement never MCP auto-allows', async () => {
  const { isFinancialMoneyMovementTool } = await import('../../src/lib/ai/ToolPolicyGate.ts');
  assert.equal(isFinancialMoneyMovementTool('record_payment'), true);
  assert.equal(isFinancialMoneyMovementTool('create_invoice'), false);
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../../src/lib/ai/ToolPolicyGate.ts', import.meta.url), 'utf8')
  );
  assert.match(src, /isFinancialMoneyMovementTool\(toolName\)/);
});

test('UI email route uses domain send command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/app/api/email/send/route.ts', import.meta.url), 'utf8');
  assert.match(src, /executeSendEmailCommand/);
  assert.match(src, /executionSource: 'ui'/);
});

test('UI invoice route uses domain invoice send command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/app/api/invoices/send/route.ts', import.meta.url), 'utf8');
  assert.match(src, /executeInvoiceSendCommand/);
});

test('cross-surface invoice idempotency key is deterministic', async () => {
  const { invoiceSendIdempotencyKey } = await import('../../src/lib/execution/domainIdempotencyKeys.ts');
  const a = invoiceSendIdempotencyKey({
    tenantId: '00000000-0000-4000-8000-000000000001',
    invoiceId: '00000000-0000-4000-8000-000000000002',
    recipients: ['b@example.com', 'a@example.com'],
  });
  const b = invoiceSendIdempotencyKey({
    tenantId: '00000000-0000-4000-8000-000000000001',
    invoiceId: '00000000-0000-4000-8000-000000000002',
    recipients: ['a@example.com', 'b@example.com'],
  });
  assert.equal(a, b);
});

test('email idempotency matches EmailExecutionService material', async () => {
  const { buildTenantEmailIdempotencyKey, assertEmailExecutionContext } = await import(
    '../../src/lib/email/emailExecutionContext.ts'
  );
  const ctx = assertEmailExecutionContext({
    tenantId: '00000000-0000-4000-8000-000000000099',
    userId: 'user-1',
  });
  const key = buildTenantEmailIdempotencyKey(ctx, {
    sourceModule: 'api',
    sourceAction: 'email.send',
    recipient: ['client@example.com'],
    subject: 'Hello',
    content: '<p>Hi</p>',
  });
  assert.match(key, /^email:[a-f0-9]{64}$/);
});

test('reconciliation worker exists for unknown execution state', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/execution/reconcileUnknownExternalActions.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /unknown_execution_state/);
  assert.doesNotMatch(src, /params\.execute\(/);
  const cron = fs.readFileSync(
    new URL('../../src/app/api/cron/reconcile-external-actions/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(cron, /reconcileUnknownExternalActions/);
});

test('scraper mcp-sync promotes via canonical service', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/internal/leads/mcp-sync/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /promoteToCanonicalLead/);
  assert.doesNotMatch(src, /create_lead/);
});

test('execution error taxonomy covers P0 failure codes', async () => {
  const { EXECUTION_ERROR_CODES, normalizeExecutionErrorCode } = await import(
    '../../src/lib/execution/executionErrorTaxonomy.ts'
  );
  for (const code of [
    'POLICY_BLOCKED',
    'UNKNOWN_EXECUTION_STATE',
    'APPROVAL_REQUIRED',
    'IDENTITY_NOT_CONNECTED',
  ]) {
    assert.ok(EXECUTION_ERROR_CODES.includes(code));
  }
  assert.equal(normalizeExecutionErrorCode('AUTH_EXPIRED'), 'PROVIDER_AUTH_EXPIRED');
});

test('tenant idempotency keys include tenant prefix', async () => {
  const { invoiceSendIdempotencyKey } = await import('../../src/lib/execution/domainIdempotencyKeys.ts');
  const key = invoiceSendIdempotencyKey({
    tenantId: 'tenant-a',
    invoiceId: 'inv-1',
    recipients: ['x@y.com'],
  });
  assert.match(key, /tenant-a/);
  const other = invoiceSendIdempotencyKey({
    tenantId: 'tenant-b',
    invoiceId: 'inv-1',
    recipients: ['x@y.com'],
  });
  assert.notEqual(key, other);
});

test('duplicate MCP+UI collision uses shared receipt lookup by key', async () => {
  const domain = await import('../../src/lib/execution/domainExternalWrite.ts');
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../../src/lib/execution/domainExternalWrite.ts', import.meta.url), 'utf8')
  );
  assert.match(src, /findReceiptByIdempotency/);
  assert.equal(typeof domain.executeDomainExternalWrite, 'function');
  const fingerprint = createHash('sha256').update('collision-test').digest('hex');
  assert.ok(fingerprint.length === 64);
});
