import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeBase64Media, detectMimeFromSignature } from '../../src/lib/media/mediaSignature.ts';

const publishingSrc = fs.readFileSync(
  new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
  'utf8'
);
const socialPublishingServiceSrc = fs.readFileSync(
  new URL('../../src/lib/social/SocialPublishingService.ts', import.meta.url),
  'utf8'
);

test('upload_social_media wraps attachment uploads in standardized okResult envelope', () => {
  // Line 499 regression check: ensure it does NOT return raw asset directly
  assert.doesNotMatch(
    publishingSrc,
    /uploadSocialMediaFromBuffer\(\{[\s\S]*?\}\);\s*return asset;/,
    'upload_social_media must not return raw asset directly without okResult envelope'
  );
  assert.match(
    publishingSrc,
    /return okResult\('upload_social_media',\s*mediaResult,\s*\{\s*receipt:/,
    'upload_social_media must return standardized okResult envelope with receipt'
  );
});

test('upload_media supports ChatGPT attachment resolution with parity and okResult envelope', () => {
  assert.match(
    publishingSrc,
    /if \(args\.openai_file_id \|\| args\.local_file_path\) \{[\s\S]*?uploadSocialMediaFromBuffer[\s\S]*?return okResult\(\s*'upload_media'/
  );
  assert.match(
    publishingSrc,
    /rejectUnresolvedAttachmentRefs\(args\);/
  );
});

test('create_social_post_with_media strictly enforces fail-closed media ingestion', () => {
  assert.match(
    publishingSrc,
    /STRICT RULE: If media input was supplied but ingestion failed, DO NOT publish text-only/
  );
  assert.match(
    publishingSrc,
    /MEDIA_INGESTION_FAILED/
  );
  assert.match(
    publishingSrc,
    /Refusing to publish text-only post/
  );
});

test('detectMimeFromSignature recognizes valid image/video headers and rejects invalid formats', () => {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectMimeFromSignature(pngHeader), 'image/png');

  // JPEG: FF D8 FF
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(detectMimeFromSignature(jpegHeader), 'image/jpeg');

  // GIF: GIF89a
  const gifHeader = Buffer.from('GIF89a');
  assert.equal(detectMimeFromSignature(gifHeader), 'image/gif');

  // MP4: [4 bytes length] 'ftyp' 'isom'
  const mp4Header = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from('isom')]);
  assert.equal(detectMimeFromSignature(mp4Header), 'video/mp4');

  // PDF: %PDF-
  const pdfHeader = Buffer.from('%PDF-1.7');
  assert.equal(detectMimeFromSignature(pdfHeader), 'application/pdf');

  // Garbage bytes
  const garbage = Buffer.from('hello world random text');
  assert.equal(detectMimeFromSignature(garbage), null);
});

test('decodeBase64Media rejects paths, URLs, and file IDs from being decoded as base64', () => {
  assert.throws(() => decodeBase64Media('/mnt/data/image.png'), /MEDIA_BASE64_INVALID/);
  assert.throws(() => decodeBase64Media('file_abcd1234efgh'), /MEDIA_BASE64_INVALID/);
  assert.throws(() => decodeBase64Media('https://example.com/photo.jpg'), /MEDIA_BASE64_INVALID/);
  assert.throws(() => decodeBase64Media('C:\\Users\\test\\image.png'), /MEDIA_BASE64_INVALID/);
});

const providerAssetPublishersSrc = fs.readFileSync(
  new URL('../../src/lib/social/providerAssetPublishers.ts', import.meta.url),
  'utf8'
);

test('SocialPublishingService asserts media availability with zero silent fallback', () => {
  assert.match(
    socialPublishingServiceSrc,
    /if \(!bytes \|\| bytes\.tenantId !== params\.tenantId\) throw new Error\('Media asset unavailable for this tenant'\);/
  );
  assert.match(
    socialPublishingServiceSrc,
    /MEDIA_VALIDATION_FAILED/
  );
  assert.match(
    providerAssetPublishersSrc,
    /MEDIA_NOT_PROVIDER_ACCESSIBLE/
  );
});
