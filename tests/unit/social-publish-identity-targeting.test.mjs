/**
 * Social publish identity targeting — MCP contract + resolution logic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  resolvePublishIdentityFromList,
  formatIdentityCandidates,
} = await import('../../src/lib/social/socialIdentityStore.ts');
const { TenantIsolationError } = await import('../../src/lib/social/tenantGuard.ts');
const { publishSocialPostJsonSchema } = await import(
  '../../src/lib/mcp/tools/socialPublishContract.ts'
);

const TENANT = '11111111-1111-4111-8111-111111111111';

function identity(overrides) {
  return {
    identity_id: overrides.identity_id,
    connection_id: 'conn-1',
    tenant_id: TENANT,
    provider: overrides.provider,
    identity_type: overrides.identity_type,
    provider_identity_id: overrides.provider_identity_id,
    provider_identity_urn: overrides.provider_identity_urn ?? null,
    display_name: overrides.display_name,
    can_publish: overrides.can_publish ?? true,
    can_upload_media: true,
    can_read_insights: false,
    is_default: overrides.is_default ?? false,
    is_active: true,
    metadata: null,
  };
}

const linkedinPersonal = identity({
  identity_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  provider: 'linkedin',
  identity_type: 'linkedin_person',
  provider_identity_id: 'member-123',
  provider_identity_urn: 'urn:li:person:abc',
  display_name: 'LinkedIn Personal',
});

const linkedinOrg = identity({
  identity_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  provider: 'linkedin',
  identity_type: 'linkedin_organization',
  provider_identity_id: 'org-456',
  provider_identity_urn: 'urn:li:organization:456',
  display_name: 'AlphaClone Org',
});

const facebookPage = identity({
  identity_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  provider: 'facebook',
  identity_type: 'facebook_page',
  provider_identity_id: '106807848991283',
  display_name: 'AlphaClone Page',
});

test('publish jsonSchema exposes identity_id and identity_type for ChatGPT', () => {
  const props = publishSocialPostJsonSchema.properties;
  assert.ok(props.identity_id, 'identity_id must be in MCP jsonSchema');
  assert.ok(props.identity_type, 'identity_type must be in MCP jsonSchema');
  assert.ok(props.platform, 'platform must be in MCP jsonSchema');
  assert.match(String(props.identity_id.description), /connected_accounts|get_social_identities/i);
});

test('single LinkedIn personal → auto-select without identity_id', () => {
  const resolved = resolvePublishIdentityFromList([linkedinPersonal], {
    provider: 'linkedin',
    allowDefault: true,
  });
  assert.equal(resolved.identity_id, linkedinPersonal.identity_id);
  assert.equal(resolved.identity_type, 'linkedin_person');
});

test('single LinkedIn organization → auto-select without identity_id', () => {
  const resolved = resolvePublishIdentityFromList([linkedinOrg], {
    provider: 'linkedin',
    allowDefault: true,
  });
  assert.equal(resolved.identity_id, linkedinOrg.identity_id);
  assert.equal(resolved.identity_type, 'linkedin_organization');
});

test('personal + organization → publish personal using identity_id', () => {
  const resolved = resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
    provider: 'linkedin',
    identityId: linkedinPersonal.identity_id,
  });
  assert.equal(resolved.identity_type, 'linkedin_person');
  assert.equal(resolved.provider_identity_id, 'member-123');
});

test('personal + organization → publish organization using identity_id', () => {
  const resolved = resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
    provider: 'linkedin',
    identityId: linkedinOrg.identity_id,
  });
  assert.equal(resolved.identity_type, 'linkedin_organization');
  assert.equal(resolved.provider_identity_id, 'org-456');
});

test('personal + organization → identity_type linkedin_person resolves personal', () => {
  const resolved = resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
    provider: 'linkedin',
    identityType: 'linkedin_person',
  });
  assert.equal(resolved.identity_id, linkedinPersonal.identity_id);
});

test('personal + organization → identity_type linkedin_organization resolves org', () => {
  const resolved = resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
    provider: 'linkedin',
    identityType: 'linkedin_organization',
  });
  assert.equal(resolved.identity_id, linkedinOrg.identity_id);
});

test('multiple identities + no identity_id → TARGET_AMBIGUOUS', () => {
  assert.throws(
    () =>
      resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
        provider: 'linkedin',
        allowDefault: true,
      }),
    (err) =>
      err instanceof TenantIsolationError &&
      err.code === 'TARGET_AMBIGUOUS' &&
      Array.isArray(err.details?.available_identities) &&
      err.details.available_identities.length === 2
  );
});

test('invalid identity_id → IDENTITY_NOT_FOUND', () => {
  assert.throws(
    () =>
      resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
        provider: 'linkedin',
        identityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      }),
    (err) => err instanceof TenantIsolationError && err.code === 'IDENTITY_NOT_FOUND'
  );
});

test('raw provider org id without identity_type → IDENTITY_NOT_FOUND with guidance', () => {
  assert.throws(
    () =>
      resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
        provider: 'linkedin',
        identityId: 'org-456',
      }),
    (err) => err instanceof TenantIsolationError && err.code === 'IDENTITY_NOT_FOUND'
  );
});

test('provider id + matching identity_type → resolves (backward compat)', () => {
  const resolved = resolvePublishIdentityFromList([linkedinPersonal, linkedinOrg], {
    provider: 'linkedin',
    identityId: 'org-456',
    identityType: 'linkedin_organization',
  });
  assert.equal(resolved.identity_id, linkedinOrg.identity_id);
});

test('non-publishable identity → IDENTITY_NOT_PUBLISHABLE', () => {
  const blocked = { ...linkedinPersonal, can_publish: false };
  assert.throws(
    () =>
      resolvePublishIdentityFromList([blocked], {
        identityId: blocked.identity_id,
      }),
    (err) => err instanceof TenantIsolationError && err.code === 'IDENTITY_NOT_PUBLISHABLE'
  );
});

test('single Facebook page still auto-selects', () => {
  const resolved = resolvePublishIdentityFromList([facebookPage], {
    provider: 'facebook',
    allowDefault: true,
  });
  assert.equal(resolved.identity_type, 'facebook_page');
  assert.equal(resolved.provider_identity_id, '106807848991283');
});

test('Facebook + LinkedIn with platform=facebook only considers Facebook', () => {
  const resolved = resolvePublishIdentityFromList(
    [facebookPage, linkedinPersonal, linkedinOrg],
    { provider: 'facebook', allowDefault: true }
  );
  assert.equal(resolved.identity_id, facebookPage.identity_id);
});

test('formatIdentityCandidates includes identity_name and provider_identity_id', () => {
  const candidates = formatIdentityCandidates([linkedinPersonal]);
  assert.equal(candidates[0].identity_name, 'LinkedIn Personal');
  assert.equal(candidates[0].provider_identity_id, 'member-123');
});

test('connected_accounts source uses internal identity_id in listSocialAccounts', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/identityResolution.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /identity_id: i\.identity_id/);
  assert.match(src, /provider_identity_id: i\.provider_identity_id/);
  assert.match(src, /listTenantSocialIdentities/);
});

test('MCP registry publish_post uses shared schema with identity_id (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /publishSocialPostJsonSchema/);
  assert.match(src, /name: 'publish_post'/);
});

test('legacy empty social_identities falls back to legacy tables (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/socialIdentityStore.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /if \(mapped\.length > 0\) return mapped/);
  assert.match(src, /listLegacyIdentities\(tenantId, provider, activeOnly\)/);
});

test('create_linkedin_post overrides legacy MCPServer path (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /name: 'create_linkedin_post'/);
  assert.match(src, /handlePublishSocialPost/);
});

test('social publish MCP tools use extended timeout budget (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/mcpToolExecutionBudget.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /create_linkedin_post/);
  assert.match(src, /SOCIAL_PUBLISH_TIMEOUT_MS/);
});

test('toolManifest includes publish_post with identity_id property', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/services/mcp/toolManifest.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /name: 'publish_post'/);
  assert.match(src, /identity_id.*connected_accounts/s);
});
