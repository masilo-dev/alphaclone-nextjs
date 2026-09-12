/**
 * LinkedIn tenant-routing contract.
 *
 * Regression coverage for the silent personal-vs-organization routing bug.
 * The production invariant is tenant-scoped and provider-neutral: explicit
 * destination/account selection must never fall back to another connected
 * identity, and a client-supplied identity_id must be resolved only inside the
 * active tenant.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { resolvePublishIdentityFromList } = await import(
  '../../src/lib/social/socialIdentityStore.ts'
);
const { TenantIsolationError } = await import('../../src/lib/social/tenantGuard.ts');

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

function identity(overrides) {
  return {
    identity_id: overrides.identity_id,
    connection_id: overrides.connection_id || 'conn-1',
    tenant_id: overrides.tenant_id,
    provider: 'linkedin',
    identity_type: overrides.identity_type,
    provider_identity_id: overrides.provider_identity_id,
    provider_identity_urn: overrides.provider_identity_urn || null,
    display_name: overrides.display_name || overrides.identity_id,
    can_publish: overrides.can_publish ?? true,
    can_upload_media: true,
    can_read_insights: false,
    is_default: overrides.is_default ?? false,
    is_active: true,
    metadata: null,
  };
}

const tenantAPerson = identity({
  identity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenant_id: TENANT_A,
  identity_type: 'linkedin_person',
  provider_identity_id: 'member-a',
  provider_identity_urn: 'urn:li:person:a',
});

const tenantAOrg1 = identity({
  identity_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenant_id: TENANT_A,
  identity_type: 'linkedin_organization',
  provider_identity_id: 'org-a-1',
  provider_identity_urn: 'urn:li:organization:101',
});

const tenantAOrg2 = identity({
  identity_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  tenant_id: TENANT_A,
  identity_type: 'linkedin_organization',
  provider_identity_id: 'org-a-2',
  provider_identity_urn: 'urn:li:organization:102',
  is_default: true,
});

const tenantBOrg = identity({
  identity_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  tenant_id: TENANT_B,
  identity_type: 'linkedin_organization',
  provider_identity_id: 'org-b-1',
  provider_identity_urn: 'urn:li:organization:201',
});

test('foreign tenant identity_id cannot be resolved by the active tenant', () => {
  assert.throws(
    () =>
      resolvePublishIdentityFromList(
        [tenantAPerson, tenantAOrg1, tenantAOrg2, tenantBOrg],
        {
          tenantId: TENANT_A,
          provider: 'linkedin',
          identityId: tenantBOrg.identity_id,
          identityType: 'linkedin_organization',
        }
      ),
    (err) => err instanceof TenantIsolationError && err.code === 'IDENTITY_NOT_FOUND'
  );
});

test('explicit internal identity_id resolves only that tenant-owned organization', () => {
  const resolved = resolvePublishIdentityFromList(
    [tenantAPerson, tenantAOrg1, tenantAOrg2, tenantBOrg],
    {
      tenantId: TENANT_A,
      provider: 'linkedin',
      identityId: tenantAOrg1.identity_id,
      identityType: 'linkedin_organization',
    }
  );
  assert.equal(resolved.identity_id, tenantAOrg1.identity_id);
  assert.equal(resolved.provider_identity_id, 'org-a-1');
});

test('explicit personal destination rejects an organization identity as hard mismatch', () => {
  assert.throws(
    () =>
      resolvePublishIdentityFromList([tenantAPerson, tenantAOrg1], {
        tenantId: TENANT_A,
        provider: 'linkedin',
        identityId: tenantAOrg1.identity_id,
        identityType: 'linkedin_person',
      }),
    (err) =>
      err instanceof TenantIsolationError &&
      err.code === 'LINKEDIN_DESTINATION_MISMATCH'
  );
});

test('canonical publish path disables defaults whenever destination/account is explicit', () => {
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/socialPublishTool.ts', import.meta.url),
    'utf8'
  );

  assert.match(src, /allowDefault:\s*!identityId\s*&&\s*!identityType/);
  assert.match(src, /requested_destination:\s*destination\s*\|\|\s*null/);
  assert.match(src, /LINKEDIN_DESTINATION_MISMATCH/);
});

test('create_linkedin_post preserves explicit post_as instead of injecting another account', () => {
  const normalize = fs.readFileSync(
    new URL('../../src/lib/mcp/normalizeToolArguments.ts', import.meta.url),
    'utf8'
  );
  const publishing = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );

  assert.match(normalize, /explicitDestination/);
  assert.match(normalize, /!explicitDestination/);
  assert.match(publishing, /post_as=personal/);
  assert.match(publishing, /LINKEDIN_DESTINATION_MISMATCH/);
});
