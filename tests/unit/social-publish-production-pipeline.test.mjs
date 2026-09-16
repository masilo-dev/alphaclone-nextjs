import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deterministicPublishKey, normalizeSocialCaption } from '../../src/lib/social/publishIdempotency.ts';
import { decodeBase64Media, detectMimeFromSignature } from '../../src/lib/media/mediaSignature.ts';

const migration = fs.readFileSync('supabase/migrations/20260915042254_social_publish_operation_pipeline.sql', 'utf8');
const instagram = fs.readFileSync('src/lib/social/providerAssetPublishers.ts', 'utf8');
const wrappers = fs.readFileSync('src/lib/mcp/tools/social-publishing.ts', 'utf8');
const crons = fs.readFileSync('railway.crons.json', 'utf8');

test('deterministic idempotency includes tenant, identity, platform, checksum, caption and time', () => {
  const base = { tenantId: 't1', identityId: 'i1', platform: 'instagram', mediaChecksum: 'abc', caption: ' hello   world ', requestedPublishTime: null };
  assert.equal(deterministicPublishKey(base), deterministicPublishKey({ ...base, caption: 'hello world' }));
  assert.notEqual(deterministicPublishKey(base), deterministicPublishKey({ ...base, identityId: 'i2' }));
  assert.notEqual(deterministicPublishKey(base), deterministicPublishKey({ ...base, requestedPublishTime: '2026-09-15T12:00:00Z' }));
  assert.equal(normalizeSocialCaption('A\r\nB   C'), 'A\nB C');
});

test('paths, URLs and OpenAI IDs are never accepted as literal base64', () => {
  for (const invalid of ['/workspace/scratch/upload/video.mp4', 'https://example.com/video.mp4', 'file_abc123']) assert.throws(() => decodeBase64Media(invalid), /MEDIA_BASE64_INVALID/);
});

test('signature detection rejects declared-name tricks and recognizes MP4', () => {
  const header = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from('isom')]);
  assert.equal(detectMimeFromSignature(header), 'video/mp4');
  assert.equal(detectMimeFromSignature(Buffer.from('not a video')), null);
});

test('operation table enforces tenant idempotency and provider uniqueness', () => {
  assert.match(migration, /UNIQUE \(tenant_id, idempotency_key\)/);
  assert.match(migration, /social_publish_operations_provider_post_uq/);
  assert.match(migration, /social_publish_operations_container_uq/);
  assert.match(migration, /social_identities si[\s\S]*si\.tenant_id = social_publish_operations\.tenant_id/);
});

test('Instagram wrapper persists the container before returning pending', () => {
  const update = instagram.indexOf("state: 'provider_processing'");
  const returnReceipt = instagram.indexOf('return operationReceipt(operation)', update);
  assert.ok(update > 0 && returnReceipt > update);
  assert.match(instagram, /reconcileDueInstagramOperations/);
  assert.match(instagram, /fields=id,permalink,timestamp,username/);
});

test('Instagram reconciliation cannot strand verifying or reconciliation_required operations', () => {
  assert.match(instagram, /INSTAGRAM_RECONCILABLE_STATES[\s\S]*'reconciliation_required'[\s\S]*'verifying'/);
  assert.match(instagram, /state: 'failed_retryable'[\s\S]*INSTAGRAM_RECONCILIATION_FAILED/);
  assert.match(instagram, /locked_by: null, locked_until: null/);
  assert.match(crons, /reconcile-social-posts\", \"schedule\": \"\*\/1 \* \* \* \*\"/);
});

test('LinkedIn organization implies LinkedIn and mismatch is a hard error', () => {
  assert.match(wrappers, /impliedLinkedIn/);
  const service = fs.readFileSync('src/lib/social/SocialPublishingService.ts', 'utf8');
  assert.match(service, /LINKEDIN_DESTINATION_MISMATCH/);
});

test('Instagram provider deletion limitation preserves the internal ledger', () => {
  assert.match(wrappers, /INSTAGRAM_PROVIDER_DELETE_UNAVAILABLE/);
  assert.match(wrappers, /AlphaClone kept the ledger record unchanged/);
});
