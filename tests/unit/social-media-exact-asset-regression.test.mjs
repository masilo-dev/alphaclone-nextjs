import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('legacy AI generators never substitute Unsplash stock media', () => {
  const src = read('src/lib/mcp/tools/gap-tools-email-social.ts');
  assert.doesNotMatch(src, /photo-1618005182384-a83a8bd57fbe/);
  assert.match(src, /AI_IMAGE_GENERATION_UNAVAILABLE/);
});

test('ChatGPT sandbox paths fail with a typed bytes-unavailable error', () => {
  const src = read('src/lib/media/attachmentResolver.ts');
  assert.match(src, /CHAT_ATTACHMENT_BYTES_UNAVAILABLE/);
  assert.doesNotMatch(src, /MCP_ATTACHMENT_ROOTS \|\| '[^']*\/mnt\/data/);
});

test('canonical ingestion rejects local paths before interpreting media', () => {
  const src = read('src/lib/media/ingestMedia.ts');
  assert.match(src, /rejectLocalAiPaths\(candidate, 'media'\)/);
  assert.match(src, /rejectLocalAiPaths\(targetUrl, 'media_url'\)/);
});

test('Instagram direct publish forwards explicit idempotency key and uses durable processing', () => {
  const mcp = read('src/lib/mcp/tools/social-publishing.ts');
  const provider = read('src/lib/social/providerAssetPublishers.ts');
  const ledger = read('src/lib/social/publishOperationService.ts');
  assert.match(mcp, /idempotencyKey: args\.idempotency_key/);
  assert.match(provider, /idempotencyKey: input\.idempotencyKey/);
  assert.match(ledger, /input\.idempotencyKey \|\| deterministicPublishKey/);
  assert.match(provider, /state: 'provider_processing'/);
  assert.match(provider, /provider_container_id: creationId/);
});

test('provider accessibility failures are fail-closed', () => {
  const provider = read('src/lib/social/providerAssetPublishers.ts');
  assert.match(provider, /MEDIA_NOT_PROVIDER_ACCESSIBLE/);
  assert.doesNotMatch(provider, /defaultImage|fallbackUrl|DEFAULT_ASSET|firstAvailableImage/);
});
