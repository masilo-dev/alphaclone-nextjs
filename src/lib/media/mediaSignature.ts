type MagicSig = { mime: string; bytes: number[]; offset?: number };

const SIGNATURES: MagicSig[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

export function decodeBase64Media(contentBase64: string): Buffer {
  if (contentBase64 == null || String(contentBase64).trim() === '') {
    throw new Error('MEDIA_INPUT_MISSING: base64 media content is required');
  }
  const raw = String(contentBase64).trim();
  const dataUrl = raw.match(/^data:([^;,]+);base64,([\s\S]*)$/i);
  if (/^data:/i.test(raw) && !dataUrl) throw new Error('MEDIA_BASE64_INVALID: malformed or non-base64 data URL');
  const cleaned = (dataUrl ? dataUrl[2] : raw).replace(/\s+/g, '');
  if (!cleaned) throw new Error('MEDIA_INPUT_MISSING: base64 media content is empty');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || /=/.test(cleaned.slice(0, -2))) {
    throw new Error('MEDIA_BASE64_INVALID: content contains invalid base64 characters');
  }
  const unpadded = cleaned.replace(/=+$/, '');
  if (unpadded.length % 4 === 1) throw new Error('MEDIA_BASE64_INVALID: content has an impossible base64 length');
  const padded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
  const binary = Buffer.from(padded, 'base64');
  if (!binary.length || binary.toString('base64').replace(/=+$/, '') !== unpadded) {
    throw new Error('MEDIA_BASE64_DECODE_FAILED: decoded bytes do not round-trip');
  }
  return binary;
}

export function detectMimeFromSignature(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    if (!sig.bytes.every((byte, index) => buffer[offset + index] === byte)) continue;
    if (sig.mime === 'image/webp') {
      if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
      continue;
    }
    return sig.mime;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'video/quicktime';
  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8').trimStart();
  if (/^<\?xml[\s\S]*?<svg\b/i.test(head) || /^<svg\b/i.test(head)) return 'image/svg+xml';
  return null;
}
