/**
 * Hardened media upload for social publishing.
 * Never stores data URIs in media_urls. Tenant-scoped Supabase storage.
 */

import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPublicMediaUrl, extractMediaAssetIdFromUrl } from '@/lib/media/mediaPublicUrl';
import { createProviderFetchUrl } from '@/lib/media/providerFetchUrl';
import { logMediaPipelineStep } from '@/lib/social/mediaPipelineLog';
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
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/i);
  if (!match) return { isDataUri: false };
  return { isDataUri: true, mimeType: match[1], base64: match[2] };
}

export function decodeBase64Media(contentBase64: string): Buffer {
  if (contentBase64 == null || String(contentBase64).trim() === '') {
    throw new Error('content_base64 is required');
  }
  const marker = contentBase64.indexOf('base64,');
  const normalized = marker >= 0 ? contentBase64.slice(marker + 7) : contentBase64;
  const cleaned = normalized.replace(/[\r\n\s]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new Error('MEDIA_BASE64_DECODE_FAILED: content_base64 is malformed');
  }
  const binary = Buffer.from(cleaned, 'base64');
  if (!binary.length) throw new Error('content_base64 is invalid or empty');
  const canonicalInput = cleaned.replace(/=+$/, '');
  const canonicalDecoded = binary.toString('base64').replace(/=+$/, '');
  if (canonicalDecoded !== canonicalInput) {
    throw new Error('MEDIA_BASE64_DECODE_FAILED: decoded bytes do not round-trip');
  }
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

export type UploadSocialMediaFromBufferInput = {
  tenantId: string;
  userId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  altText?: string | null;
  correlationId?: string;
};

async function persistSocialMediaAsset(params: {
  tenantId: string;
  userId: string;
  filename: string;
  effectiveMime: string;
  binary: Buffer;
  altText?: string | null;
  assetType: string;
  ext: string;
  checksum: string;
  dims: { width: number | null; height: number | null };
}): Promise<MediaAssetResult> {
  const storagePath = `media/${params.tenantId}/${Date.now()}-${params.checksum.slice(0, 12)}.${params.ext}`;
  const supabase = createSupabaseAdminClient();

  const { error: uploadError } = await supabase.storage.from('public-assets').upload(storagePath, params.binary, {
    contentType: params.effectiveMime,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: storedBlob, error: verifyError } = await supabase.storage.from('public-assets').download(storagePath);
  if (verifyError || !storedBlob) {
    await supabase.storage.from('public-assets').remove([storagePath]);
    throw new Error('MEDIA_STORAGE_INTEGRITY_FAILED: stored object could not be read back');
  }
  const stored = Buffer.from(await storedBlob.arrayBuffer());
  const storedChecksum = createHash('sha256').update(stored).digest('hex');
  if (stored.length !== params.binary.length || storedChecksum !== params.checksum) {
    await supabase.storage.from('public-assets').remove([storagePath]);
    throw new Error('MEDIA_STORAGE_INTEGRITY_FAILED: stored media differs from decoded source');
  }

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;
  if (!publicUrl || isDataUri(publicUrl)) {
    throw new Error('Upload succeeded but no provider-fetchable URL was returned');
  }

  async function verifyPublicFetch(assetId: string): Promise<void> {
    const providerUrl = createProviderFetchUrl({ tenantId: params.tenantId, assetId });
    try {
      const response = await fetch(providerUrl, { redirect: 'follow' });
      const fetched = Buffer.from(await response.arrayBuffer());
      const fetchedMime = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      const fetchedChecksum = createHash('sha256').update(fetched).digest('hex');
      if (!response.ok || fetchedMime !== params.effectiveMime || fetched.length !== params.binary.length || fetchedChecksum !== params.checksum) {
        throw new Error(`HTTP ${response.status}, MIME ${fetchedMime || 'missing'}, bytes ${fetched.length}`);
      }
      const { error } = await supabase.from('media_assets').update({ status: 'ready', failure_code: null, failure_message: null })
        .eq('tenant_id', params.tenantId).eq('id', assetId);
      if (error) throw error;
    } catch (error) {
      await supabase.from('media_assets').update({
        status: 'failed', failure_code: 'MEDIA_PUBLIC_INTEGRITY_FAILED',
        failure_message: error instanceof Error ? error.message : 'Public media verification failed',
      }).eq('tenant_id', params.tenantId).eq('id', assetId);
      throw new Error('MEDIA_PUBLIC_INTEGRITY_FAILED: public provider URL did not preserve the uploaded bytes');
    }
  }

  const { data: asset, error: assetErr } = await supabase
    .from('media_assets')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      file_name: params.filename,
      file_type: params.effectiveMime,
      asset_type: params.assetType,
      storage_path: storagePath,
      public_url: publicUrl,
      file_size_bytes: params.binary.length,
      alt_text: params.altText || '',
      checksum_sha256: params.checksum,
      width: params.dims.width,
      height: params.dims.height,
      tags: ['social-publishing'],
      status: 'processing',
      metadata: {
        source_bytes: params.binary.length,
        stored_bytes: stored.length,
        integrity_verified: true,
        public_fetch_verified: true,
      },
    })
    .select('id, public_url, file_name, file_type, file_size_bytes, width, height, alt_text, checksum_sha256')
    .single();

  if (assetErr && (assetErr.code === '42703' || /column|does not exist/i.test(assetErr.message || ''))) {
    const fallback = await supabase
      .from('media_assets')
      .insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        file_name: params.filename,
        file_type: params.effectiveMime,
        asset_type: params.assetType,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size_bytes: params.binary.length,
        alt_text: params.altText || '',
        tags: ['social-publishing'],
      })
      .select('id, public_url, file_name, file_type, file_size_bytes, alt_text')
      .single();
    if (fallback.error) throw new Error(fallback.error.message);
    await verifyPublicFetch(fallback.data.id);
    return {
      media_asset_id: fallback.data.id,
      public_url: fallback.data.public_url,
      filename: fallback.data.file_name,
      mime_type: fallback.data.file_type || params.effectiveMime,
      size_bytes: fallback.data.file_size_bytes || params.binary.length,
      width: params.dims.width,
      height: params.dims.height,
      checksum: params.checksum,
      alt_text: fallback.data.alt_text || null,
      source_bytes: params.binary.length,
      stored_bytes: stored.length,
      integrity_verified: true,
      public_fetch_verified: true,
    };
  }

  if (assetErr) throw new Error(assetErr.message);

  await verifyPublicFetch(asset.id);

  return {
    media_asset_id: asset.id,
    public_url: asset.public_url,
    filename: asset.file_name,
    mime_type: asset.file_type || params.effectiveMime,
    size_bytes: asset.file_size_bytes || params.binary.length,
    width: asset.width ?? params.dims.width,
    height: asset.height ?? params.dims.height,
    checksum: asset.checksum_sha256 || params.checksum,
    alt_text: asset.alt_text || null,
    source_bytes: params.binary.length,
    stored_bytes: stored.length,
    integrity_verified: true,
    public_fetch_verified: true,
  };
}

async function validateAndPrepareBinary(
  binary: Buffer,
  filename: string,
  declaredMime: string
): Promise<{
  effectiveMime: string;
  assetType: string;
  ext: string;
  checksum: string;
  dims: { width: number | null; height: number | null };
}> {
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
  const declaredFamily = declaredMime.split('/')[0];
  const detectedFamily = detectedNorm.split('/')[0];
  if (declaredFamily !== detectedFamily) {
    throw new Error(
      `MIME mismatch: declared ${declaredMime} but file signature is ${detectedNorm}`
    );
  }
  if (normalizeMime(declaredMime) !== detectedNorm) {
    throw new Error(`MEDIA_MIME_MISMATCH: declared ${declaredMime} but file signature is ${detectedNorm}`);
  }

  if (detectedFamily === 'image' && detectedNorm !== 'image/svg+xml') {
    try {
      const { default: sharp } = await import('sharp');
      const image = sharp(binary, { failOn: 'error', limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) throw new Error('missing dimensions');
      await sharp(binary, { failOn: 'error', limitInputPixels: 40_000_000 })
        .resize({ width: 1, height: 1 })
        .raw()
        .toBuffer();
    } catch {
      throw new Error('MEDIA_IMAGE_CORRUPT: image bytes cannot be fully decoded');
    }
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

  return { effectiveMime, assetType, ext, checksum, dims };
}

/** Upload from an in-memory buffer — avoids base64 encode/decode memory duplication. */
export async function uploadSocialMediaFromBuffer(
  input: UploadSocialMediaFromBufferInput
): Promise<MediaAssetResult> {
  const filename = String(input.filename || '').trim();
  const declaredMime = normalizeMime(input.mimeType || '');
  if (!filename) throw new Error('filename is required');
  if (!declaredMime) throw new Error('mime_type is required');
  if (!ALLOWED_MIME.has(declaredMime)) {
    throw new Error(`Unsupported mime_type: ${declaredMime}`);
  }

  logMediaPipelineStep({
    step: 'media_received',
    tenantId: input.tenantId,
    userId: input.userId,
    correlationId: input.correlationId,
    mimeType: declaredMime,
    sizeBytes: input.buffer.length,
    filename,
  });

  const prepared = await validateAndPrepareBinary(input.buffer, filename, declaredMime);
  const result = await persistSocialMediaAsset({
    tenantId: input.tenantId,
    userId: input.userId,
    filename,
    altText: input.altText,
    binary: input.buffer,
    ...prepared,
  });

  logMediaPipelineStep({
    step: 'media_uploaded',
    tenantId: input.tenantId,
    userId: input.userId,
    correlationId: input.correlationId,
    mediaAssetId: result.media_asset_id,
    mimeType: result.mime_type,
    sizeBytes: result.size_bytes,
    filename: result.filename,
  });

  return result;
}

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

  const marker = input.contentBase64.indexOf('base64,');
  const cleaned = (marker >= 0 ? input.contentBase64.slice(marker + 7) : input.contentBase64).replace(/[\r\n\s]/g, '');
  const binary = decodeBase64Media(input.contentBase64);
  const result = await uploadSocialMediaFromBuffer({
    tenantId: input.tenantId,
    userId: input.userId,
    filename,
    mimeType: declaredMime,
    buffer: binary,
    altText: input.altText,
  });
  return { ...result, input_base64_chars: cleaned.length };
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

  // URLs and IDs are aliases for the same asset, not separate attachments.
  const rawInputs = [...new Set((params.mediaUrls || []).map((url) => url.trim()).filter(Boolean))];
  const ids = [...new Set([
    ...(params.mediaAssetIds || []).map((id) => id.trim().toLowerCase()).filter(Boolean),
    ...rawInputs.map(extractMediaAssetIdFromUrl).filter((id): id is string => Boolean(id)).map((id) => id.toLowerCase()),
  ])];
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
      urls.push(buildPublicMediaUrl(row.id));
      assetIds.push(row.id);
      types.push(row.asset_type || (String(row.file_type || '').startsWith('video/') ? 'video' : 'image'));
    }
  }

  const rawUrls = rawInputs.filter((url) => !extractMediaAssetIdFromUrl(url));
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
      urls.push(buildPublicMediaUrl(uploaded.media_asset_id));
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
    parsed.hash = '';
    const normalizedUrl = parsed.href;
    if (urls.includes(normalizedUrl)) continue;
    urls.push(normalizedUrl);
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
