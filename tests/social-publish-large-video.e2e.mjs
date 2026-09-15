import test from 'node:test';
import assert from 'node:assert/strict';

// Requires an isolated Supabase project plus Meta test identities. It is intentionally
// opt-in so CI cannot publish to a real tenant accidentally.
test('15-second 1080x1920 Facebook + Instagram timeout/idempotency/deletion regression', {
  skip: process.env.RUN_SOCIAL_PROVIDER_E2E !== '1' ? 'set RUN_SOCIAL_PROVIDER_E2E=1 with dedicated provider fixtures' : false,
}, async () => {
  const required = ['SOCIAL_E2E_TENANT_ID', 'SOCIAL_E2E_USER_ID', 'SOCIAL_E2E_FACEBOOK_IDENTITY_ID', 'SOCIAL_E2E_INSTAGRAM_IDENTITY_ID'];
  for (const name of required) assert.ok(process.env[name], `${name} is required`);
  // The provider-backed harness must upload the fixture through create_media_upload_session,
  // assert the returned original/final metadata are identical, submit twice, poll the
  // operation receipt, verify exactly one provider ID per identity, then delete and verify.
  // No production identity defaults are permitted here.
  const harness = await import('../scripts/social-provider-e2e-harness.mjs').catch(() => null);
  assert.ok(harness?.run, 'dedicated provider E2E harness is not installed in this environment');
  const result = await harness.run();
  assert.equal(result.facebook.count, 1);
  assert.equal(result.instagram.count, 1);
  assert.equal(result.media.original.checksum_sha256, result.media.final.checksum_sha256);
  assert.equal(result.providerLedgerAgreement, true);
});
