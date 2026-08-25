/**
 * MCP OAuth credential encryption + token endpoint configuration tests.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

const VALID_32 = '0123456789abcdef0123456789abcdef';
const VALID_ZOHO = 'fedcba9876543210fedcba9876543210';
const TOO_SHORT = 'short-secret';

const savedEnv = {};

function saveEnv(keys) {
  for (const key of keys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(keys) {
  for (const key of keys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

const ENV_KEYS = [
  'INTEGRATION_TOKEN_ENCRYPTION_SECRET',
  'ENCRYPTION_SECRET',
  'ZOHO_ENCRYPTION_SECRET',
  'TOKEN_ENCRYPTION_SECRET',
  'MCP_ENCRYPTION_KEY',
  'CREDENTIAL_ENCRYPTION_KEY',
];

describe('credential encryption secret resolution', () => {
  beforeEach(() => saveEnv(ENV_KEYS));
  afterEach(() => restoreEnv(ENV_KEYS));

  it('skips too-short ENCRYPTION_SECRET and uses valid ZOHO_ENCRYPTION_SECRET', async () => {
    process.env.ENCRYPTION_SECRET = TOO_SHORT;
    process.env.ZOHO_ENCRYPTION_SECRET = VALID_ZOHO;

    const { resolveCredentialEncryptionSecret } = await import(
      '../../src/lib/integration/credentialEncryptionSecret.ts'
    );
    const resolved = resolveCredentialEncryptionSecret();
    assert.ok(resolved);
    assert.equal(resolved.source, 'ZOHO_ENCRYPTION_SECRET');
    assert.equal(resolved.secret, VALID_ZOHO);
  });

  it('prefers INTEGRATION_TOKEN_ENCRYPTION_SECRET when valid', async () => {
    process.env.INTEGRATION_TOKEN_ENCRYPTION_SECRET = VALID_32;
    process.env.ENCRYPTION_SECRET = VALID_ZOHO;

    const { resolveCredentialEncryptionSecret } = await import(
      '../../src/lib/integration/credentialEncryptionSecret.ts'
    );
    const resolved = resolveCredentialEncryptionSecret();
    assert.equal(resolved?.source, 'INTEGRATION_TOKEN_ENCRYPTION_SECRET');
  });

  it('validateCredentialEncryptionForOAuth fails when all candidates invalid', async () => {
    for (const key of ENV_KEYS) {
      process.env[key] = TOO_SHORT;
    }

    const { validateCredentialEncryptionForOAuth } = await import(
      '../../src/lib/integration/credentialEncryptionSecret.ts'
    );
    const result = validateCredentialEncryptionForOAuth();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.invalidVars.includes('ENCRYPTION_SECRET'));
    }
  });

  it('encrypt → decrypt round-trip survives process restart with same secret', async () => {
    process.env.ENCRYPTION_SECRET = VALID_32;

    const { encryptIntegrationToken, decryptIntegrationToken } = await import(
      '../../src/lib/integration/integrationTokenCrypto.ts'
    );
    const plain = 'mcp_at_testtokenvalue1234567890';
    const encrypted = await encryptIntegrationToken(plain);
    assert.notEqual(encrypted, plain);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

    delete process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = VALID_32;

    const decrypted = await decryptIntegrationToken(encrypted);
    assert.equal(decrypted, plain);
  });
});

describe('production env encryption validation', () => {
  it('accepts ZOHO fallback when ENCRYPTION_SECRET is too short', async () => {
    const { validateProductionEnv } = await import('../../scripts/production-env.mjs');
    const base = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      CRON_SECRET: 'cron-secret-value',
      BREVO_PLATFORM_API_KEY: 'brevo-key',
      TURNSTILE_SECRET: 'turnstile-secret',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site',
      PUBLIC_APP_ORIGIN: 'https://alphaclonesystems.com',
      ENCRYPTION_SECRET: TOO_SHORT,
      ZOHO_ENCRYPTION_SECRET: VALID_ZOHO,
    };
    const result = validateProductionEnv(base);
    assert.equal(result.configured['credential encryption secret'], 'ZOHO_ENCRYPTION_SECRET');
    assert.ok(
      result.errors.some((e) => e.includes('ENCRYPTION_SECRET') && e.includes('32')),
      `expected ENCRYPTION_SECRET length warning, got: ${result.errors.join('; ')}`,
    );
  });
});

describe('MCP token route uses service-role admin client', () => {
  it('imports createSupabaseAdminClient and hasSupabaseServiceRole', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/app/api/mcp/token/route.ts', 'utf8'),
    );
    assert.match(source, /createSupabaseAdminClient/);
    assert.match(source, /hasSupabaseServiceRole/);
    assert.match(source, /validateCredentialEncryptionForOAuth/);
    assert.doesNotMatch(source, /ENV\.SUPABASE_SERVICE_ROLE_KEY/);
  });
});
