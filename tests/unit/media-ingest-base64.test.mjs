import test from 'node:test';
import assert from 'node:assert/strict';

test('decodeBase64Media rejects empty content', async () => {
  const { decodeBase64Media } = await import('../../src/lib/social/mediaUpload.ts');
  assert.throws(() => decodeBase64Media(''), /content_base64 is required/i);
  assert.throws(() => decodeBase64Media(undefined), /content_base64 is required/i);
});

test('ingestMedia base64 accepts legacy base64 field name', async () => {
  // Minimal PNG 1x1 pixel base64
  const tinyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const { ingestMediaInput } = await import('../../src/lib/media/ingestMedia.ts');

  // Should throw on missing tenant/user in real upload, but must not throw
  // "Cannot read properties of undefined (reading 'includes')" before validation.
  await assert.rejects(
    () =>
      ingestMediaInput({
        tenantId: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        media: {
          type: 'base64',
          base64: tinyPng,
          filename: 'test.png',
          mimeType: 'image/png',
        },
      }),
    (err) => {
      assert.doesNotMatch(String(err?.message || err), /reading 'includes'/i);
      return true;
    }
  );
});
