/**
 * Secure HTTPS unsubscribe link tests
 */
import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';

describe('buildUnsubscribeUrl HTTPS enforcement', () => {
  const priorEnv = { ...process.env };

  before(() => {
    process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret-32-characters-min';
    process.env.PUBLIC_APP_ORIGIN = 'http://localhost:3000';
    process.env.NODE_ENV = 'production';
  });

  after(() => {
    process.env = priorEnv;
  });

  it('always returns absolute HTTPS unsubscribe URLs in production', async () => {
    const { buildUnsubscribeUrl } = await import('../../src/lib/email/unsubscribeToken.ts');
    const url = buildUnsubscribeUrl('client@example.com', 'tenant-123');
    assert.match(url, /^https:\/\//);
    assert.doesNotMatch(url, /localhost|127\.0\.0\.1/);
    assert.match(url, /\/api\/unsubscribe\?/);
  });

  it('resolvePublicHttpsOrigin upgrades http localhost in production', async () => {
    const { resolvePublicHttpsOrigin } = await import('../../src/lib/siteUrl.ts');
    assert.equal(resolvePublicHttpsOrigin(), 'https://alphaclonesystems.com');
  });
});
