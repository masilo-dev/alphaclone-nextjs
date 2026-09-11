import test from 'node:test';
import assert from 'node:assert/strict';
import { withPreservedQuery, trialHrefForPlan, TRIAL_HREF, DEMO_HREF } from '../../src/lib/marketing/cta.ts';

test('withPreservedQuery keeps UTM params on trial links', () => {
  const next = withPreservedQuery(
    TRIAL_HREF,
    '?utm_source=linkedin&utm_campaign=launch&foo=ignore'
  );
  assert.match(next, /utm_source=linkedin/);
  assert.match(next, /utm_campaign=launch/);
  assert.doesNotMatch(next, /foo=ignore/);
  assert.match(next, /register=true/);
});

test('withPreservedQuery does not overwrite existing destination params', () => {
  const next = withPreservedQuery(
    '/auth/login?register=true&type=business&plan=pro&utm_source=existing',
    '?utm_source=linkedin'
  );
  assert.match(next, /utm_source=existing/);
  assert.doesNotMatch(next, /utm_source=linkedin/);
});

test('trialHrefForPlan uses approved plan ids', () => {
  assert.equal(
    trialHrefForPlan('starter'),
    '/auth/login?register=true&type=business&plan=starter'
  );
  assert.equal(
    trialHrefForPlan('enterprise'),
    '/auth/login?register=true&type=business&plan=enterprise'
  );
});

test('demo href stays on internal booking route', () => {
  assert.equal(DEMO_HREF, '/book-demo');
});
