import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chasingPolicySchema,
  createRunRequestSchema,
  eventEnvelopeSchema,
  executionModeSchema,
  invoiceChaseTargetSchema,
  taskStatusSchema,
  verificationResultSchema,
} from '../../src/lib/bonnie/runtime/schemas/index.ts';
import {
  DEFAULT_INVOICE_CHASE_POLICY,
  shouldStopChase,
} from '../../src/lib/bonnie/runtime/chasingService.ts';

test('execution modes exclude unrestricted full autonomy', () => {
  assert.ok(executionModeSchema.options.includes('autonomous_low_risk'));
  assert.equal(executionModeSchema.safeParse('fully_autonomous').success, false);
  assert.equal(executionModeSchema.safeParse('semi_autonomous').success, true);
});

test('create run request validates template and objective', () => {
  const ok = createRunRequestSchema.safeParse({
    tenantId: '11111111-1111-4111-8111-111111111111',
    objective: 'Chase unpaid invoices until paid or escalated',
    workflowTemplate: 'invoice_collection',
  });
  assert.equal(ok.success, true);

  const bad = createRunRequestSchema.safeParse({
    tenantId: 'not-a-uuid',
    objective: 'x',
  });
  assert.equal(bad.success, false);
});

test('invoice chase target schema', () => {
  const parsed = invoiceChaseTargetSchema.parse({
    invoiceId: 'inv-1',
    customerId: null,
    amountDue: '120.50',
    currency: 'GBP',
  });
  assert.equal(parsed.invoiceId, 'inv-1');
});

test('chasing policy defaults are bounded', () => {
  const policy = chasingPolicySchema.parse({
    targetType: 'unpaid_invoice',
    terminalOutcomes: ['PAID', 'ESCALATED'],
  });
  assert.ok(policy.maxAttempts <= 20);
  assert.equal(policy.requireApproval, true);
  assert.equal(DEFAULT_INVOICE_CHASE_POLICY.maxAttempts, 5);
});

test('shouldStopChase respects terminal signals', () => {
  assert.equal(shouldStopChase('PAID', DEFAULT_INVOICE_CHASE_POLICY), true);
  assert.equal(shouldStopChase('paid', DEFAULT_INVOICE_CHASE_POLICY), true);
  assert.equal(shouldStopChase('STILL_WAITING', DEFAULT_INVOICE_CHASE_POLICY), false);
});

test('event envelope requires tenant and event identity', () => {
  const ok = eventEnvelopeSchema.safeParse({
    event_id: 'evt_1',
    event_type: 'invoice.paid',
    tenant_id: '11111111-1111-4111-8111-111111111111',
    payload: { invoiceId: 'x' },
  });
  assert.equal(ok.success, true);
});

test('verification result schema', () => {
  const result = verificationResultSchema.parse({
    verified: true,
    outcome: 'COMPLETED',
    checks: [{ name: 'all_tasks_terminal_or_waiting_ok', passed: true }],
    summary: 'ok',
  });
  assert.equal(result.verified, true);
});

test('task status schema includes EXECUTION_UNCERTAIN', () => {
  assert.equal(taskStatusSchema.safeParse('EXECUTION_UNCERTAIN').success, true);
  assert.equal(taskStatusSchema.safeParse('NOT_A_STATUS').success, false);
});
