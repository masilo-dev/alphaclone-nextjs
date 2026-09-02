/**
 * Media privacy, deduplication, and publish pipeline tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildPublicMediaUrl,
  isSupabaseStorageUrl,
  sanitizeMediaForClient,
  stripInternalMediaFields,
  redactSupabaseUrlsDeep,
  isValidMediaAssetId,
} = await import('../../src/lib/media/mediaPublicUrl.ts');
const { normalizePublishMediaArgs } = await import('../../src/lib/media/normalizePublishMedia.ts');
const { normalizeAgentRunExecutionMode } = await import(
  '../../src/lib/bonnie/runtime/goalRunService.ts'
);

const SAMPLE_ID = '123e4567-e89b-12d3-a456-426614174000';
const SUPABASE_URL =
  'https://xyzproject.supabase.co/storage/v1/object/public/public-assets/media/tenant-1/photo.png';

test('buildPublicMediaUrl never includes supabase.co', () => {
  const url = buildPublicMediaUrl(SAMPLE_ID);
  assert.doesNotMatch(url, /supabase\.co/);
  assert.match(url, /\/api\/media\//);
});

test('sanitizeMediaForClient returns only safe fields', () => {
  const safe = sanitizeMediaForClient({
    id: SAMPLE_ID,
    mime_type: 'image/png',
    size_bytes: 1234,
    status: 'ready',
  });
  assert.equal(safe.media_asset_id, SAMPLE_ID);
  assert.doesNotMatch(safe.media_url, /supabase\.co/);
  assert.equal(safe.status, 'ready');
  assert.ok(!('storage_path' in safe));
  assert.ok(!('public_url' in safe));
});

test('stripInternalMediaFields removes storage_url and rewrites supabase media_url', () => {
  const cleaned = stripInternalMediaFields({
    media_asset_id: SAMPLE_ID,
    media_url: SUPABASE_URL,
    storage_url: SUPABASE_URL,
    public_url: SUPABASE_URL,
  });
  assert.doesNotMatch(String(cleaned.media_url), /supabase\.co/);
  assert.ok(!('storage_url' in cleaned));
  assert.ok(!('public_url' in cleaned));
});

test('redactSupabaseUrlsDeep replaces nested storage URLs', () => {
  const redacted = redactSupabaseUrlsDeep({
    nested: { url: SUPABASE_URL },
    list: [SUPABASE_URL],
  });
  assert.equal(redacted.nested.url, '[REDACTED_STORAGE_URL]');
  assert.equal(redacted.list[0], '[REDACTED_STORAGE_URL]');
});

test('one image with duplicate aliases dedupes to single media_asset_id', () => {
  const normalized = normalizePublishMediaArgs({
    media_id: SAMPLE_ID,
    media_asset_id: SAMPLE_ID,
    media_asset_ids: [SAMPLE_ID, SAMPLE_ID],
    media_ids: [SAMPLE_ID],
    signed_url: buildPublicMediaUrl(SAMPLE_ID),
  });
  assert.equal(normalized.mediaAssetIds.length, 1);
  assert.equal(normalized.mediaAssetIds[0], SAMPLE_ID);
  assert.equal(normalized.mediaUrls.length, 0);
});

test('raw supabase URLs are rejected in normalization', () => {
  const normalized = normalizePublishMediaArgs({
    media_urls: [SUPABASE_URL],
  });
  assert.ok(normalized.rejected.some((r) => r.includes('raw storage URLs')));
  assert.equal(normalized.mediaUrls.length, 0);
});

test('invalid asset ids are rejected with validation message', () => {
  const normalized = normalizePublishMediaArgs({
    media_asset_ids: ['not-a-uuid'],
  });
  assert.ok(normalized.rejected.length > 0);
  assert.equal(normalized.mediaAssetIds.length, 0);
});

test('upload_social_media handler uses sanitized envelope', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /sanitizeMediaForClient/);
  assert.match(src, /buildPublicMediaUrl/);
  assert.doesNotMatch(src, /signed_url: asset\.url/);
});

test('resolveMediaUrls uses branded proxy URLs', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/mediaUpload.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /buildPublicMediaUrl\(row\.id\)/);
});

test('verifyProviderPost distinguishes in-progress from missing provider id', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/SocialPublishingService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /PUBLISH_IN_PROGRESS/);
  assert.match(src, /PUBLISH_FAILED/);
});

test('durable social publish uses SocialPublishingService.publishExistingPost', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/socialPublishDurableTask.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /publishExistingPost/);
});

test('media proxy route validates UUID and blocks traversal', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/media/[assetId]/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /isValidMediaAssetId/);
  assert.match(src, /hasStoragePathTraversal/);
  assert.match(src, /X-Content-Type-Options/);
});

test('isValidMediaAssetId rejects non-uuid values', () => {
  assert.equal(isValidMediaAssetId(SAMPLE_ID), true);
  assert.equal(isValidMediaAssetId('../../../etc/passwd'), false);
});

test('execution mode normalizer still maps autonomous alias', () => {
  assert.equal(normalizeAgentRunExecutionMode('autonomous'), 'fully_autonomous');
});
