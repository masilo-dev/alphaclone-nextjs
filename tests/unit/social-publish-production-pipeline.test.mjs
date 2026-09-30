import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deterministicPublishKey, normalizeSocialCaption } from '../../src/lib/social/publishIdempotency.ts';
import { decodeBase64Media, detectMimeFromSignature } from '../../src/lib/media/mediaSignature.ts';

const migration = fs.readFileSync('supabase/migrations/20260915042254_social_publish_operation_pipeline.sql', 'utf8');
const instagram = fs.readFileSync('src/lib/social/providerAssetPublishers.ts', 'utf8');
const wrappers = fs.readFileSync('src/lib/mcp/tools/social-publishing.ts', 'utf8');
const crons = fs.readFileSync('railway.crons.json', 'utf8');
const crm = fs.readFileSync('src/components/dashboard/CRMTab.tsx', 'utf8');
const pwa = fs.readFileSync('src/contexts/PWAContext.tsx', 'utf8');
const charts = fs.readFileSync('src/components/ui/ChartContainer.tsx', 'utf8');

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

test('Instagram publish waits for FINISHED, returns pending with no fake provider ID, and blocks ambiguous retries', () => {
  assert.match(instagram, /waitForInstagramContainerReady\(creationId, token, \{ timeoutMs: 12_000/);
  assert.match(instagram, /if \(ready\.status_code === 'FINISHED'\)[\s\S]*?media_publish/);
  assert.match(instagram, /provider_post_id: string \| null/);
  assert.match(instagram, /INSTAGRAM_PUBLISH_OUTCOME_UNKNOWN/);
  assert.match(instagram, /operation\.failure_code === 'INSTAGRAM_PUBLISH_OUTCOME_UNKNOWN'[\s\S]*?reconciliation_required/);
  assert.doesNotMatch(instagram, /operation\.failure_code === 'INSTAGRAM_PUBLISH_OUTCOME_UNKNOWN'\s*\|\|\s*operation\.failure_code === 'INSTAGRAM_CONTAINER_STATUS_UNKNOWN'/);
  assert.match(instagram, /retry_safe: false, failure_code: 'INSTAGRAM_PUBLISH_OUTCOME_UNKNOWN'/);
  assert.match(instagram, /publish_operation_id: operation\.id/);
});

test('Instagram cron repairs post-operation links and never creates replacement provider containers', () => {
  assert.match(instagram, /eq\('provider_container_id', post\.provider_container_id\)/);
  assert.match(instagram, /publish_operation_id: existing\.id/);
  assert.match(instagram, /social_post_id: post\.id/);
  assert.doesNotMatch(instagram, /providerAssetPublishers[\s\S]*?reconcileDueInstagramOperations[\s\S]*?\/media['"`]/);
});

test('CRM does not query Microsoft presence for lead and customer email addresses', () => {
  assert.doesNotMatch(crm, /fetchTeamsPresence\(/);
  assert.match(crm, /isTeamsConnected=\{false\}/);
});

test('PWA captures the browser prompt once and chart wrapper unmounts zero-size charts', () => {
  assert.match(pwa, /if \(pwaActive\) return/);
  assert.match(pwa, /setDeferredPrompt\(null\)/);
  assert.match(pwa, /outcome: isIOS \? 'manual_install' : 'unavailable'/);
  assert.match(charts, /setHasSize\(width > 0 && height > 0\)/);
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
