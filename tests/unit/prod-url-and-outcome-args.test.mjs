/**
 * Public OAuth redirects + define_outcome arg coercion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const {
  normalizeDefineOutcomeArgs,
  coerceOutcomeStatus,
} = await import('../../src/lib/bonnie/outcomeArgs.ts');

test('outcomeArgs coerces status aliases and non-array criteria', () => {
  assert.equal(coerceOutcomeStatus('completed'), 'success');
  assert.equal(coerceOutcomeStatus('failed'), 'failure');
  assert.equal(coerceOutcomeStatus('mixed'), 'partial');

  const normalized = normalizeDefineOutcomeArgs({
    tenant_id: '11111111-1111-1111-1111-111111111111',
    status: 'completed',
    criteria: 'Lead replied',
    notes: 'ok',
  });

  assert.equal(normalized.status, 'success');
  assert.equal(normalized.criteria.length, 1);
  assert.equal(normalized.criteria[0].metric, 'Lead replied');
  assert.equal(normalized.criteria[0].met, true);

  const missingCriteria = normalizeDefineOutcomeArgs({
    tenantId: '11111111-1111-1111-1111-111111111111',
    status: 'failed',
  });
  assert.equal(missingCriteria.status, 'failure');
  assert.equal(missingCriteria.criteria[0].metric, 'session_outcome');
  assert.equal(missingCriteria.criteria[0].met, false);
});

test('calendly and integration OAuth redirects use publicAppUrl / PUBLIC_APP_ORIGIN', () => {
  const files = [
    'src/app/api/auth/calendly/connect/route.ts',
    'src/app/api/auth/calendly/callback/route.ts',
    'src/app/api/auth/facebook/callback/route.ts',
    'src/app/api/auth/hubspot/callback/route.ts',
    'src/app/api/auth/microsoft/connect/route.ts',
    'src/app/api/auth/instagram/callback/route.ts',
  ];

  for (const file of files) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(src, /PUBLIC_APP_ORIGIN|publicAppUrl/, `${file} must use public origin helpers`);
    assert.doesNotMatch(
      src,
      /new URL\([^)]+,\s*req\.url\)/,
      `${file} must not redirect relative to req.url`
    );
  }
});
