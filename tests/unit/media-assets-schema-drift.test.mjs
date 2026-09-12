import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const migration = read('supabase/migrations/20260912160000_media_assets_canonical_schema.sql');

const canonicalColumns = [
  'id', 'tenant_id', 'user_id', 'file_name', 'file_type', 'asset_type',
  'storage_provider', 'storage_path', 'public_url', 'thumbnail_url',
  'file_size_bytes', 'checksum_sha256', 'width', 'height', 'status',
  'failure_code', 'failure_message', 'metadata', 'created_at', 'updated_at',
];

test('media_assets drift migration supplies every canonical application column', () => {
  for (const column of canonicalColumns) {
    assert.match(migration, new RegExp(`(?:ADD COLUMN IF NOT EXISTS\\s+${column}|\\('${column}'\\))`, 'i'));
  }
  assert.match(migration, /assert_media_assets_schema/);
  assert.match(migration, /storage_provider SET DEFAULT 'supabase'/);
  assert.match(migration, /thumbnail_url TEXT/);
});

test('legacy media metadata is backfilled without dropping legacy production columns', () => {
  for (const legacy of ['name', 'filename', 'mime_type', 'media_type', 'size_bytes', 'file_size', 'media_url']) {
    assert.match(migration, new RegExp(`column_name = '${legacy}'`));
  }
  assert.doesNotMatch(migration, /DROP COLUMN/i);
});

test('runtime media queries use canonical names and validate schema before reads', () => {
  const audit = read('src/lib/social/alphaNexus.ts');
  assert.match(audit, /file_name, file_type, file_size_bytes/);
  assert.doesNotMatch(audit, /select\('id, name, mime_type, file_size/);

  const ingest = read('src/lib/media/ingestMedia.ts');
  assert.match(ingest, /assertCanonicalMediaAssetsSchema\(\)/);
  assert.match(ingest, /file_name, file_type, file_size_bytes/);

  const listTools = read('src/lib/mcp/tools/social-publishing.ts');
  assert.match(listTools, /storage_provider, status, created_at/);
  assert.match(listTools, /assertCanonicalMediaAssetsSchema\(\)/);
});
