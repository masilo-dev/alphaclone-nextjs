import test from 'node:test';
import assert from 'node:assert/strict';

const {
  humanizeTechnicalFailure,
  businessOutcomeSummary,
  isTechnicalJargonText,
  businessToolActivity,
} = await import('../../src/lib/copy/businessFriendlyErrors.ts');

const ZOD_DUMP = JSON.stringify([
  { expected: 'array', code: 'invalid_type', path: ['criteria'], message: 'Invalid input' },
  {
    code: 'invalid_value',
    values: ['success', 'partial', 'failure'],
    path: ['status'],
    message: 'Invalid input',
  },
]);

test('humanizeTechnicalFailure rewrites Zod criteria/status dumps', () => {
  const msg = humanizeTechnicalFailure(ZOD_DUMP, { tool: 'define_outcome' });
  assert.match(msg, /success checklist|result status|Checked whether/i);
  assert.doesNotMatch(msg, /invalid_type|Invalid input/);
});

test('businessOutcomeSummary never returns raw Zod for failed define_outcome', () => {
  const summary = businessOutcomeSummary({
    tool: 'define_outcome',
    success: false,
    errorMessage: ZOD_DUMP,
  });
  assert.equal(isTechnicalJargonText(summary), false);
  assert.match(summary, /Ask Bonnie|checklist|status/i);
});

test('businessToolActivity maps define_outcome to business language', () => {
  assert.equal(businessToolActivity('define_outcome'), 'Checked whether the work succeeded');
});
