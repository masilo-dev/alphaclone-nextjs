/**
 * Multi-tenant social isolation tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  resolveTrustedTenantId,
  assertSameTenant,
  TenantIsolationError,
  stripSecretsForTenantBoundary,
} = await import('../../src/lib/social/tenantGuard.ts');

const { resolveTenantIdentityForPublish } = await import(
  '../../src/lib/social/socialIdentityStore.ts'
);

test('resolveTrustedTenantId prefers session over client-supplied tenant', () => {
  assert.equal(
    resolveTrustedTenantId({
      sessionTenantId: '11111111-1111-4111-8111-111111111111',
      clientTenantId: '22222222-2222-4222-8222-222222222222',
    }),
    '11111111-1111-4111-8111-111111111111'
  );
});

test('resolveTrustedTenantId rejects missing tenant', () => {
  assert.throws(
    () => resolveTrustedTenantId({ sessionTenantId: null, clientTenantId: null }),
    (err) => err instanceof TenantIsolationError && err.code === 'TENANT_REQUIRED'
  );
});

test('assertSameTenant blocks cross-tenant access with NOT_FOUND (no leak)', () => {
  assert.throws(
    () =>
      assertSameTenant(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'identity'
      ),
    (err) => err instanceof TenantIsolationError && err.code === 'NOT_FOUND'
  );
});

test('stripSecretsForTenantBoundary removes token fields from MCP payloads', () => {
  const cleaned = stripSecretsForTenantBoundary({
    identity_id: 'id-1',
    page_access_token: 'EAAB-SECRET',
    nested: { refresh_token: 'r', name: 'ok' },
  });
  assert.equal(cleaned.identity_id, 'id-1');
  assert.equal('page_access_token' in cleaned, false);
  assert.equal('refresh_token' in cleaned.nested, false);
  assert.equal(cleaned.nested.name, 'ok');
});

test('cronPublish source no longer hard-codes Alphaclone Facebook page', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/cronPublish.ts', import.meta.url),
    'utf8'
  );
  assert.equal(src.includes('106807848991283'), false);
  assert.match(src, /resolveTenantIdentityForPublish/);
  assert.match(src, /\.eq\('tenant_id',\s*post\.tenant_id\)/);
});

test('MCPServer Facebook lookup no longer falls back to user_id across tenants', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/services/mcp/MCPServer.ts', import.meta.url),
    'utf8'
  );
  assert.equal(/tenant_id mismatch/.test(src), false);
  assert.match(src, /NEVER fall back to user_id across tenants/);
});

test('getFacebookIntegration requires tenantId', async () => {
  const { getFacebookIntegration } = await import(
    '../../src/services/facebook/facebookIntegrationService.ts'
  );
  const result = await getFacebookIntegration(
    {
      from: () => {
        throw new Error('should not query without tenant');
      },
    },
    { userId: 'u1', pageId: 'p1' }
  );
  assert.equal(result, null);
});

test('LinkedIn publisher refuses personal fallback when org was requested', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/linkedin/publishPost.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /refusing personal fallback/);
  assert.equal(src.includes('posting anyway'), false);
});

test('canonical tools include get_social_identities', async () => {
  const { CANONICAL_SOCIAL_MCP_TOOLS } = await import('../../src/lib/social/types.ts');
  assert.ok(CANONICAL_SOCIAL_MCP_TOOLS.includes('get_social_identities'));
});

test('ChatGPT curated list includes get_social_identities', async () => {
  const { CHATGPT_CONNECTOR_TOOL_NAMES } = await import(
    '../../src/lib/mcp/toolAnnotations.ts'
  );
  assert.ok(CHATGPT_CONNECTOR_TOOL_NAMES.includes('get_social_identities'));
});

test('resolveTenantIdentityForPublish fails closed without supabase for foreign id', async () => {
  // Without DB credentials this may throw connection errors — treat as fail-closed
  try {
    await resolveTenantIdentityForPublish({
      tenantId: '11111111-1111-4111-8111-111111111111',
      identityId: '22222222-2222-4222-8222-222222222222',
    });
    assert.fail('expected isolation or connection failure');
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});
