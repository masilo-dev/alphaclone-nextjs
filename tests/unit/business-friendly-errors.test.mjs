import test from 'node:test';
import assert from 'node:assert/strict';

const {
  humanizeTechnicalFailure,
  businessOutcomeSummary,
  isTechnicalJargonText,
  businessToolActivity,
  sanitizeUserFacingError,
  extractErrorMessage,
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

const CONNECTOR_ERROR_JSON = JSON.stringify({
  ok: false,
  tool: 'upload_social_media',
  error: {
    code: 'UPLOAD_FAILED',
    message: "Cannot read properties of undefined (reading 'includes')",
    retryable: false,
  },
});

const DB_CONSTRAINT_ERROR =
  'new row for relation "agent_runs" violates check constraint "agent_runs_execution_mode_check"';

test('sanitizeUserFacingError hides JS runtime errors from connector JSON', () => {
  const msg = sanitizeUserFacingError(CONNECTOR_ERROR_JSON, { tool: 'upload_social_media' });
  assert.doesNotMatch(msg, /undefined|includes|UPLOAD_FAILED/);
  assert.match(msg, /server error|AlphaClone Systems/i);
});

test('sanitizeUserFacingError hides postgres schema errors', () => {
  const msg = sanitizeUserFacingError(DB_CONSTRAINT_ERROR, {
    tool: 'publish_social_post',
    preferGeneric: true,
  });
  assert.doesNotMatch(msg, /agent_runs|constraint|relation/i);
  assert.match(msg, /server error|AlphaClone Systems/i);
});

test('extractErrorMessage reads nested MCP error.message', () => {
  assert.equal(
    extractErrorMessage(CONNECTOR_ERROR_JSON),
    "Cannot read properties of undefined (reading 'includes')"
  );
});

test('extractErrorMessage never yields "[object Object]" for structured payloads', () => {
  // Shape that produced "[object Object]" entries in nexus_decision_log for
  // get_tickets / search_clients before the fix.
  const structured = { ok: false, error: { code: 'PGRST301', details: 'JWT expired' } };
  const msg = extractErrorMessage(structured);
  assert.notEqual(msg, '[object Object]');
  assert.match(msg, /PGRST301/);

  assert.equal(extractErrorMessage({ summary: 'No tickets matched' }), 'No tickets matched');
  assert.equal(extractErrorMessage({ reason: 'rate limited' }), 'rate limited');
  assert.equal(extractErrorMessage({}), null);
});
