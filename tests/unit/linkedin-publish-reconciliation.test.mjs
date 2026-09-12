import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveDurablePublishOutcome, canAutomaticallyRetryPublish } = await import(
  '../../src/lib/social/publishOutcome.ts'
);

test('LinkedIn success followed by client timeout reconciles without duplicate retry', () => {
  const providerReference = 'urn:li:ugcPost:7250000000000000000';
  const outcome = resolveDurablePublishOutcome({
    providerConfirmedPost: false,
    providerOutcomeIsAmbiguous: true,
    reconciledProviderReference: providerReference,
  });
  assert.equal(outcome, 'reconciled');
  assert.equal(canAutomaticallyRetryPublish({ status: 'outcome_unknown', providerReference }), false);
});

test('ambiguous write without evidence remains outcome_unknown and is never auto-retried', () => {
  assert.equal(resolveDurablePublishOutcome({
    providerConfirmedPost: false,
    providerOutcomeIsAmbiguous: true,
  }), 'outcome_unknown');
  assert.equal(canAutomaticallyRetryPublish({ status: 'outcome_unknown' }), false);
});

test('positive provider rejection is failed and may be retried after correction', () => {
  assert.equal(resolveDurablePublishOutcome({
    providerConfirmedPost: false,
    providerOutcomeIsAmbiguous: false,
  }), 'failed');
  assert.equal(canAutomaticallyRetryPublish({ status: 'failed' }), true);
});

test('provider reference is persisted before secondary LinkedIn processing', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../../src/lib/linkedin/publishPost.ts', import.meta.url), 'utf8');
  const save = source.indexOf('updateSocialPostLinkedInUrnWithRetry(admin, postId, patch)');
  const confirmation = source.indexOf('return { ok: true, platform: \'linkedin\', postUrn');
  assert.ok(save > 0 && confirmation > save);
  assert.match(source, /status: 'provider_accepted'/);
});

test('identity resolver remains unchanged by reconciliation work', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../../src/lib/social/SocialPublishingService.ts', import.meta.url), 'utf8');
  assert.match(source, /identity\.identity_type === 'linkedin_organization'/);
  assert.match(source, /identity\.identity_type === 'linkedin_person'/);
});
