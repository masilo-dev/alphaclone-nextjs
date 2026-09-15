import test from 'node:test';
import assert from 'node:assert/strict';

// The default harness uses isolated provider simulators and generated tenant identities.
// Live-provider validation remains separately opt-in and must use dedicated test accounts.
test('15-second 1080x1920 Facebook + Instagram timeout/idempotency/deletion regression', async () => {
  const harness = await import('../scripts/social-provider-e2e-harness.mjs');
  const result = await harness.run();
  assert.equal(result.facebook.count, 1);
  assert.equal(result.instagram.count, 1);
  assert.equal(result.media.original.checksum_sha256, result.media.final.checksum_sha256);
  assert.equal(result.media.original.byte_count, result.media.final.byte_count);
  assert.equal(result.instagram.exceededClientTimeout, true);
  assert.ok(result.facebook.operation.providerId);
  assert.ok(result.facebook.operation.permalink);
  assert.ok(result.instagram.operation.providerId);
  assert.ok(result.instagram.operation.permalink);
  assert.equal(result.providerLedgerAgreement, true);
});
