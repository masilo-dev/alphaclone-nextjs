/**
 * Hardened media upload for social publishing.
 * Never stores data URIs in media_urls. Tenant-scoped Supabase storage.
 */

import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { MediaAssetResult } from './types';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
]);

type MagicSig = { mime: string; bytes: number[]; offset?: number };

const SIGNATURES: MagicSig[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ....ftyp
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

export function isDataUri(value: string): boolean {
  return /^data:[^;]+;base64,/i.test(String(value || '').trim());
}

export function rejectOrExtractDataUri(value: string): {
  isDataUri: boolean;
  mimeType?: string;
  base64?: string;
} {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return { isDataUri: false };
  return { isDataUri: true, mimeType: match[1], base64: match[2] };
}

export function decodeBase64Media(contentBase64: string): Buffer {
  if (contentBase64 == null || String(contentBase64).trim() === '') {
    throw new Error('content_base64 is required');
  }
  const normalized = contentBase64.includes('base64,')
    ? contentBase64.split('base64,').pop() || ''
    : contentBase64;
  const binary = Buffer.from(normalized.replace(/\s/g, ''), 'base64');
  if (!binary.length) throw new Error('content_base64 is invalid or empty');
  return binary;
}

export function detectMimeFromSignature(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;
    if (sig.mime === 'image/webp') {
      // Confirm WEBP marker at bytes 8-11
      if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
      }
      continue;
    }
    if (sig.mime === 'video/mp4') return 'video/mp4';
    return sig.mime;
  }
  // QuickTime / MOV often has ftyp with different brands
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/quicktime';
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8').trimStart();
  if (/^<\?xml[\s\S]*?<svg\b/i.test(head) || /^<svg\b/i.test(head)) {
    return 'image/svg+xml';
  }
  return null;
}

function assertSafeSvg(buffer: Buffer): void {
  const svg = buffer.toString('utf8');
  if (/<script\b|javascript:|<foreignObject\b|on(?:load|error|click)\s*=/i.test(svg)) {
    throw new Error('SVG contains executable or embedded active content');
  }
}

function normalizeMime(mime: string): string {
  const m = mime.trim().toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    // SOF0 / SOF2
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

export function extractImageDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number | null; height: number | null } {
  try {
    if (mimeType === 'image/png') {
      const d = readPngDimensions(buffer);
      return { width: d?.width ?? null, height: d?.height ?? null };
    }
    if (mimeType === 'image/jpeg') {
      const d = readJpegDimensions(buffer);
      return { width: d?.width ?? null, height: d?.height ?? null };
    }
  } catch {
    // ignore
  }
  return { width: null, height: null };
}

export type UploadSocialMediaInput = {
  tenantId: string;
  userId: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
  altText?: string | null;
};

export async function uploadSocialMedia(
  input: UploadSocialMediaInput
): Promise<MediaAssetResult> {
  const filename = String(input.filename || '').trim();
  const declaredMime = normalizeMime(input.mimeType || '');
  if (!filename) throw new Error('filename is required');
  if (!declaredMime) throw new Error('mime_type is required');
  if (!ALLOWED_MIME.has(declaredMime)) {
    throw new Error(`Unsupported mime_type: ${declaredMime}`);
  }

  const binary = decodeBase64Media(input.contentBase64);
  const maxBytes = declaredMime.startsWith('video/')
    ? MAX_VIDEO_BYTES
    : declaredMime === 'application/pdf'
      ? MAX_DOCUMENT_BYTES
      : MAX_IMAGE_BYTES;
  if (binary.length > maxBytes) {
    throw new Error(`File exceeds maximum size of ${maxBytes} bytes`);
  }

  const detected = detectMimeFromSignature(binary);
  if (!detected) {
    throw new Error('File signature does not match a supported image/video format');
  }
  const detectedNorm = normalizeMime(detected);
  if (detectedNorm === 'image/svg+xml') assertSafeSvg(binary);
  // Allow jpeg/jpg alias and mp4/quicktime family mismatches only when both image or both video
  const declaredFamily = declaredMime.split('/')[0];
  const detectedFamily = detectedNorm.split('/')[0];
  if (declaredFamily !== detectedFamily) {
    throw new Error(
      `MIME mismatch: declared ${declaredMime} but file signature is ${detectedNorm}`
    );
  }

  const effectiveMime =
    declaredMime === 'image/jpeg' || declaredMime === 'image/png' || declaredMime === 'image/webp'
      ? declaredMime
      : detectedNorm === 'video/quicktime' && declaredMime.startsWith('video/')
        ? declaredMime
        : detectedNorm;

  const checksum = createHash('sha256').update(binary).digest('hex');
  const dims = extractImageDimensions(binary, effectiveMime.startsWith('image/') ? effectiveMime : '');
  const isVideo = effectiveMime.startsWith('video/');
  const isDocument = effectiveMime === 'application/pdf';
  const assetType = isVideo
    ? 'video'
    : isDocument
      ? 'document'
      : effectiveMime.includes('gif')
        ? 'gif'
        : 'image';
  const ext =
    filename.split('.').pop()?.toLowerCase() ||
    (effectiveMime === 'image/png'
      ? 'png'
      : effectiveMime === 'image/jpeg'
        ? 'jpg'
          : effectiveMime === 'image/webp'
          ? 'webp'
          : effectiveMime === 'image/svg+xml'
            ? 'svg'
            : effectiveMime === 'application/pdf'
              ? 'pdf'
          : isVideo
            ? 'mp4'
            : 'bin');

  // Tenant-scoped path — never share across tenants
  const storagePath = `media/${input.tenantId}/${Date.now()}-${checksum.slice(0, 12)}.${ext}`;
  const supabase = createSupabaseAdminClient();

  const { error: uploadError } = await supabase.storage.from('public-assets').upload(storagePath, binary, {
    contentType: effectiveMime,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;
  if (!publicUrl || isDataUri(publicUrl)) {
    throw new Error('Upload succeeded but no provider-fetchable URL was returned');
  }

  const { data: asset, error: assetErr } = await supabase
    .from('media_assets')
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      file_name: filename,
      file_type: effectiveMime,
      asset_type: assetType,
      storage_path: storagePath,
      public_url: publicUrl,
      file_size_bytes: binary.length,
      alt_text: input.altText || '',
      checksum_sha256: checksum,
      width: dims.width,
      height: dims.height,
      tags: ['social-publishing'],
    })
    .select('id, public_url, file_name, file_type, file_size_bytes, width, height, alt_text, checksum_sha256')
    .single();

  // Fallback if checksum/width columns do not exist yet
  if (assetErr && (assetErr.code === '42703' || /column|does not exist/i.test(assetErr.message || ''))) {
    const fallback = await supabase
      .from('media_assets')
      .insert({
        tenant_id: input.tenantId,
        user_id: input.userId,
        file_name: filename,
        file_type: effectiveMime,
        asset_type: assetType,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size_bytes: binary.length,
        alt_text: input.altText || '',
        tags: ['social-publishing'],
      })
      .select('id, public_url, file_name, file_type, file_size_bytes, alt_text')
      .single();
    if (fallback.error) throw new Error(fallback.error.message);
    return {
      media_asset_id: fallback.data.id,
      public_url: fallback.data.public_url,
      filename: fallback.data.file_name,
      mime_type: fallback.data.file_type || effectiveMime,
      size_bytes: fallback.data.file_size_bytes || binary.length,
      width: dims.width,
      height: dims.height,
      checksum,
      alt_text: fallback.data.alt_text || null,
    };
  }

  if (assetErr) throw new Error(assetErr.message);

  return {
    media_asset_id: asset.id,
    public_url: asset.public_url,
    filename: asset.file_name,
    mime_type: asset.file_type || effectiveMime,
    size_bytes: asset.file_size_bytes || binary.length,
    width: asset.width ?? dims.width,
    height: asset.height ?? dims.height,
    checksum: asset.checksum_sha256 || checksum,
    alt_text: asset.alt_text || null,
  };
}

export function rejectLocalAiPaths(value: unknown, field: string = 'media_url'): void {
  const vals = Array.isArray(value) ? value : [value];
  for (const item of vals) {
    const v = String(item || '').trim();
    if (!v) continue;
    if (
      /^\/mnt\/data\//i.test(v) ||
      /^\/tmp\//i.test(v) ||
      /^file:/i.test(v) ||
      /^sandbox:/i.test(v) ||
      /^\/?sandbox\//i.test(v) ||
      /^[A-Za-z]:\\/.test(v)
    ) {
      throw new Error(
        `${field} looks like a local AI sandbox path (${v}). ` +
          'Read the image bytes in the session, pass them as content_base64 (or data_url) to upload_media first, ' +
          'then use the returned media_url or media_id with publish_post / publish_social_post.'
      );
    }
  }
}

/**
 * Resolve media_asset_ids and/or raw URLs into http(s) URLs only.
 * data: URIs are auto-uploaded when base64 can be extracted.
 */
export async function resolveMediaUrls(params: {
  tenantId: string;
  userId: string;
  mediaAssetIds?: string[];
  mediaUrls?: string[];
}): Promise<{ urls: string[]; assetIds: string[]; types: string[] }> {
  const supabase = createSupabaseAdminClient();
  const urls: string[] = [];
  const assetIds: string[] = [];
  const types: string[] = [];

  const ids = Array.isArray(params.mediaAssetIds) ? params.mediaAssetIds.filter(Boolean) : [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('media_assets')
      .select('id, public_url, asset_type, file_type, tenant_id')
      .eq('tenant_id', params.tenantId)
      .in('id', ids);
    if (error) throw new Error(error.message);
    const byId = new Map((data || []).map((row) => [row.id, row]));
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) throw new Error(`media_asset_id not found for tenant: ${id}`);
      if (row.tenant_id !== params.tenantId) {
        throw new Error('Cross-tenant media access denied');
      }
      if (!row.public_url || isDataUri(row.public_url)) {
        throw new Error(`media_asset ${id} has no provider-fetchable URL`);
      }
      urls.push(row.public_url);
      assetIds.push(row.id);
      types.push(row.asset_type || (String(row.file_type || '').startsWith('video/') ? 'video' : 'image'));
    }
  }

  const rawUrls = Array.isArray(params.mediaUrls) ? params.mediaUrls.filter(Boolean) : [];
  rejectLocalAiPaths(rawUrls, 'media_urls');
  for (let i = 0; i < rawUrls.length; i++) {
    const raw = String(rawUrls[i]);
    if (isDataUri(raw)) {
      const extracted = rejectOrExtractDataUri(raw);
      const uploaded = await uploadSocialMedia({
        tenantId: params.tenantId,
        userId: params.userId,
        filename: `inline-media-${i + 1}.${(extracted.mimeType || 'image/png').split('/')[1] || 'png'}`,
        mimeType: extracted.mimeType || 'image/png',
        contentBase64: extracted.base64 || '',
      });
      urls.push(uploaded.public_url);
      assetIds.push(uploaded.media_asset_id);
      types.push(uploaded.mime_type.startsWith('video/') ? 'video' : 'image');
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Invalid media_url: ${raw}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Unsupported media_url protocol: ${parsed.protocol}`);
    }
    assertPublicMediaUrl(parsed);
    urls.push(raw);
    types.push(/\.(mp4|mov|webm|mkv)(\?|$)/i.test(raw) ? 'video' : 'image');
  }

  return { urls, assetIds, types };
}

/** Block SSRF via media_urls (localhost, private, link-local, metadata IPs). */
export function assertPublicMediaUrl(parsed: URL): void {
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('media_url host is not allowed');
  }
  // IPv4 private / loopback / link-local / CGNAT
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      throw new Error('media_url resolves to a private network address');
    }
  }
  // IPv6 loopback / ULA / link-local
  if (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80')
  ) {
    throw new Error('media_url resolves to a private network address');
  }
}

/** Redact tokens from logs / errors. */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/eya[A-Za-z0-9_-]{20,}/g, '[REDACTED_JWT]');
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|authorization/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}
