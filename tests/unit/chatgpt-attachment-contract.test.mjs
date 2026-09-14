import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publishing = fs.readFileSync(
  new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
  'utf8'
);
const contract = fs.readFileSync(
  new URL('../../src/lib/mcp/tools/socialPublishContract.ts', import.meta.url),
  'utf8'
);
const handler = fs.readFileSync(
  new URL('../../src/lib/mcp/tools/socialPublishTool.ts', import.meta.url),
  'utf8'
);

test('media tools expose explicit attachment source fields', () => {
  for (const field of ['openai_file_id', 'local_file_path', 'content_base64', 'data_url', 'source_url']) {
    assert.match(publishing, new RegExp(field));
    assert.match(contract, new RegExp(field));
  }
});

test('attachment references never fall through to base64 parsing', () => {
  assert.match(publishing, /CHATGPT_ATTACHMENT_UNRESOLVABLE/);
  assert.match(handler, /CHATGPT_ATTACHMENT_UNRESOLVABLE/);
  assert.match(handler, /legacyLooksLikeOpenAiFile/);
  assert.match(handler, /legacyLooksLikePath/);
});

test('canonical schemas support explicit Instagram identities', () => {
  assert.match(contract, /instagram_business/);
  assert.match(contract, /instagram_creator/);
  assert.match(contract, /facebook.*linkedin.*instagram/);
  assert.match(publishing, /platformRaw === 'instagram'/);
  assert.match(publishing, /identityType = 'instagram_business'/);
});

test('failed media ingestion refuses text-only publishing', () => {
  assert.match(publishing, /STRICT RULE: If media input was supplied but ingestion failed, DO NOT publish text-only/);
  assert.match(publishing, /Refusing to publish text-only post/);
});
