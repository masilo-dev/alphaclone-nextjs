/**
 * Unit tests for domain metric calculations and canonical routes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  percentChange,
  leadConversionRate,
  isLeadConverted,
  isDealWon,
  cashFlowSection,
  goalProgress,
  buildComparison,
  formatPercentChange,
} = await import('../../src/domain/metrics/calculations.ts');

const {
  resolveCanonicalPath,
  findDuplicateAliases,
  CANONICAL_ROUTES,
} = await import('../../src/lib/dashboard/canonicalRoutes.ts');

test('percentChange returns null for zero baseline instead of Infinity', () => {
  assert.equal(percentChange(10, 0), null);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(90, 100), -10);
});

test('leadConversionRate never invents a rate without leads', () => {
  assert.deepEqual(leadConversionRate({ total: 0, converted: 0 }), {
    rate: null,
    unavailableReason: 'No leads in this period yet',
  });
  assert.equal(leadConversionRate({ total: 10, converted: 2 }).rate, 20);
});

test('isLeadConverted rejects qualified-only and client_id-only', () => {
  assert.equal(isLeadConverted('qualified', 'abc'), false);
  assert.equal(isLeadConverted('new', 'abc'), false);
  assert.equal(isLeadConverted('converted'), true);
  assert.equal(isLeadConverted('won'), true);
});

test('isDealWon only accepts closed-won stages', () => {
  assert.equal(isDealWon('qualified'), false);
  assert.equal(isDealWon('closed_won'), true);
  assert.equal(isDealWon('won'), true);
});

test('cashFlowSection marks untracked as null not zero', () => {
  const untracked = cashFlowSection(0, false);
  assert.equal(untracked.amount, null);
  assert.equal(untracked.tracked, false);
  const tracked = cashFlowSection(1250, true);
  assert.equal(tracked.amount, 1250);
});

test('goalProgress does not invent percentages for bad goals', () => {
  assert.equal(goalProgress(50, 0).percent, null);
  assert.equal(goalProgress(50, 100).percent, 50);
});

test('buildComparison + formatPercentChange are consistent', () => {
  const cmp = buildComparison(120, 100, 'vs prior');
  assert.ok(cmp);
  assert.equal(cmp.direction, 'up');
  assert.equal(formatPercentChange(cmp.value), '+20%');
});

test('canonical aliases resolve predictably', () => {
  assert.equal(
    resolveCanonicalPath('/dashboard/finance/manage'),
    '/dashboard/business/billing/manage'
  );
  assert.equal(resolveCanonicalPath('/dashboard/messages'), '/dashboard/business/messages');
  assert.equal(resolveCanonicalPath('/dashboard/bonnie'), '/dashboard/business/bonnie');
  assert.equal(resolveCanonicalPath('/dashboard/contacts'), '/dashboard/contacts');
});

test('canonical route registry has no duplicate alias ownership', () => {
  assert.deepEqual(findDuplicateAliases(), []);
  assert.ok(CANONICAL_ROUTES.length >= 10);
});
