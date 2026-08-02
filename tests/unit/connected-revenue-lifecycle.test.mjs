import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertContractTransition,
  assertInvoiceTransition,
  canTransitionInvoice,
  connectedLifecycleActionSchema,
  normalizeOutreachRecipient,
} from '../../src/lib/revenue/connectedLifecycle.ts';

test('invoice lifecycle allows operational transitions and rejects skips', () => {
  assert.equal(canTransitionInvoice('draft', 'approved'), true);
  assert.equal(canTransitionInvoice('approved', 'sent'), true);
  assert.equal(canTransitionInvoice('sent', 'viewed'), true);
  assert.equal(canTransitionInvoice('viewed', 'partially_paid'), true);
  assert.equal(canTransitionInvoice('partially_paid', 'paid'), true);
  assert.equal(canTransitionInvoice('draft', 'paid'), false);
  assert.throws(() => assertInvoiceTransition('draft', 'paid'));
});

test('contract lifecycle uses the canonical transition graph', () => {
  assert.doesNotThrow(() => assertContractTransition('draft', 'internal_review'));
  assert.doesNotThrow(() => assertContractTransition('sent', 'viewed'));
  assert.throws(() => assertContractTransition('draft', 'active'));
});

test('lifecycle actions are tenant scoped and strictly validated', () => {
  const parsed = connectedLifecycleActionSchema.safeParse({
    action: 'link',
    tenantId: '11111111-1111-4111-8111-111111111111',
    sourceType: 'lead',
    sourceId: '22222222-2222-4222-8222-222222222222',
    targetType: 'deal',
    targetId: '33333333-3333-4333-8333-333333333333',
    relationship: 'converted_to',
  });
  assert.equal(parsed.success, true);
});

test('outreach suppressions normalize email and telephone recipients', () => {
  assert.equal(normalizeOutreachRecipient('email', ' Person@Example.COM '), 'person@example.com');
  assert.equal(normalizeOutreachRecipient('sms', '+1 (415) 555-0183'), '+14155550183');
});
