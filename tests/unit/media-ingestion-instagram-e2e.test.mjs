import test from 'node:test';
import assert from 'node:assert/strict';

const { decodeBase64Media, detectMimeFromSignature } = await import(
  '../../src/lib/social/mediaUpload.ts'
);
const { resolvePublishIdentityFromList } = await import(
  '../../src/lib/social/socialIdentityStore.ts'
);
const { createProviderFetchUrl, verifyProviderFetchToken } = await import(
  '../../src/lib/media/providerFetchUrl.ts'
);

const TENANT = '11111111-1111-4111-8111-111111111111';
const ASSET = '22222222-2222-4222-8222-222222222222';
const originalSecret = process.env.INTEGRATION_TOKEN_ENCRYPTION_SECRET;
process.env.INTEGRATION_TOKEN_ENCRYPTION_SECRET = 'test-provider-fetch-secret-32-characters-minimum';

test.after(() => {
  if (originalSecret === undefined) delete process.env.INTEGRATION_TOKEN_ENCRYPTION_SECRET;
  else process.env.INTEGRATION_TOKEN_ENCRYPTION_SECRET = originalSecret;
});

test('canonical base64 decoder preserves exact bytes across data URL, whitespace, and padding', () => {
  const source = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 0xff, 0xd9]);
  const wrapped = `data:image/jpeg;base64,\r\n${source.toString('base64').slice(0, 8)} \n${source.toString('base64').slice(8)}`;
  const decoded = decodeBase64Media(wrapped);
  assert.deepEqual(decoded, source);
  assert.equal(detectMimeFromSignature(decoded), 'image/jpeg');
});

test('canonical base64 decoder rejects malformed and empty content', () => {
  assert.throws(() => decodeBase64Media(''), /MEDIA_INPUT_MISSING/);
  assert.throws(() => decodeBase64Media('not+valid==='), /MEDIA_BASE64_INVALID/);
});

test('Instagram identity resolution is provider and tenant scoped', () => {
  const instagram = {
    identity_id: '33333333-3333-4333-8333-333333333333', connection_id: null,
    tenant_id: TENANT, provider: 'instagram', identity_type: 'instagram_business',
    provider_identity_id: '17841400000000000', provider_identity_urn: null,
    display_name: '@alpha', can_publish: true, can_upload_media: true,
    can_read_insights: true, is_default: false, is_active: true, metadata: null,
  };
  const facebook = { ...instagram, identity_id: '44444444-4444-4444-8444-444444444444', provider: 'facebook', identity_type: 'facebook_page' };
  assert.equal(resolvePublishIdentityFromList([instagram, facebook], { provider: 'instagram' }).identity_id, instagram.identity_id);
  assert.throws(() => resolvePublishIdentityFromList([{ ...instagram, tenant_id: '55555555-5555-4555-8555-555555555555' }].filter((i) => i.tenant_id === TENANT), { provider: 'instagram' }), /multiple social identities/);
});

test('multiple Instagram identities require explicit selection', () => {
  const base = {
    connection_id: null, tenant_id: TENANT, provider: 'instagram', identity_type: 'instagram_business',
    provider_identity_urn: null, display_name: '@alpha', can_publish: true, can_upload_media: true,
    can_read_insights: true, is_default: false, is_active: true, metadata: null,
  };
  assert.throws(() => resolvePublishIdentityFromList([
    { ...base, identity_id: '33333333-3333-4333-8333-333333333333', provider_identity_id: '1' },
    { ...base, identity_id: '44444444-4444-4444-8444-444444444444', provider_identity_id: '2' },
  ], { provider: 'instagram' }), (error) => error.code === 'TARGET_AMBIGUOUS');
});

test('provider fetch token is opaque, tenant-bound, expiring, and tamper evident', () => {
  const url = createProviderFetchUrl({ tenantId: TENANT, assetId: ASSET });
  const token = url.split('/').pop();
  assert.ok(token && !token.includes(TENANT) && !token.includes(ASSET));
  assert.deepEqual(verifyProviderFetchToken(token), {
    tenant_id: TENANT, asset_id: ASSET, purpose: 'social_provider_fetch',
    expires_at: verifyProviderFetchToken(token).expires_at,
  });
  assert.equal(verifyProviderFetchToken(`${token.slice(0, -1)}A`), null);
});

test('Instagram publisher uses canonical identity resolver and final media persistence', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../../src/lib/social/providerAssetPublishers.ts', import.meta.url), 'utf8');
  assert.match(source, /resolveSocialIdentity/);
  assert.match(source, /waitForInstagramContainerReady/);
  assert.match(source, /instagram_post_id: providerId/);
  assert.match(source, /createProviderFetchUrl/);
});

test('list_media_assets does not reference thumbnail_url', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url), 'utf8');
  const listBlock = source.slice(source.indexOf("name: 'list_media_assets'"), source.indexOf("name: 'delete_media'"));
  assert.doesNotMatch(listBlock, /thumbnail_url/);
});

test('canonical base64 decoder accepts missing padding and wrapped PNG payloads', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const unpadded = pngHeader.toString('base64').replace(/=+$/, '');
  assert.deepEqual(decodeBase64Media(unpadded), pngHeader);
  assert.deepEqual(decodeBase64Media(`data:image/png;base64,${unpadded.slice(0, 5)}\n${unpadded.slice(5)}`), pngHeader);
});

test('canonical base64 decoder rejects malformed data URLs and impossible lengths', () => {
  assert.throws(() => decodeBase64Media('data:image/png,not-base64'), /MEDIA_BASE64_INVALID/);
  assert.throws(() => decodeBase64Media('A'), /MEDIA_BASE64_INVALID/);
  assert.throws(() => decodeBase64Media('YWJj$'), /MEDIA_BASE64_INVALID/);
});
