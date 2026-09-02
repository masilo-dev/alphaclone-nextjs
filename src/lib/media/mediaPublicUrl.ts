/**
 * Branded public media URLs — never expose Supabase storage internals to clients.
 */

import { getPublicAppUrl } from '@/lib/server/appUrl';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPABASE_STORAGE_RE = /supabase\.co\/storage\/v1\/object/i;

export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  return Boolean(url && SUPABASE_STORAGE_RE.test(String(url)));
}

export function isValidMediaAssetId(assetId: string | null | undefined): boolean {
  return Boolean(assetId && UUID_RE.test(String(assetId).trim()));
}

/** Branded HTTPS URL Facebook/LinkedIn and MCP clients should use. */
export function buildPublicMediaUrl(assetId: string): string {
  const id = String(assetId || '').trim();
  if (!isValidMediaAssetId(id)) {
    throw new Error('Invalid media asset id');
  }
  const base = getPublicAppUrl().replace(/\/$/, '');
  return `${base}/api/media/${encodeURIComponent(id)}`;
}

export function isBrandedMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(String(url));
    return /^\/api\/media\/[0-9a-f-]{36}$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function extractMediaAssetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(String(url));
    const match = parsed.pathname.match(/\/api\/media\/([0-9a-f-]{36})/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export type SafeMediaClientPayload = {
  media_asset_id: string;
  media_url: string;
  status: string;
  mime_type?: string;
  media_type?: 'image' | 'video' | 'document';
  size_bytes?: number;
  width?: number | null;
  height?: number | null;
};

export function sanitizeMediaForClient(asset: {
  id: string;
  mime_type: string;
  size_bytes?: number;
  status?: string;
  width?: number | null;
  height?: number | null;
}): SafeMediaClientPayload {
  const mediaType = asset.mime_type.startsWith('video/')
    ? 'video'
    : asset.mime_type === 'application/pdf'
      ? 'document'
      : 'image';
  return {
    media_asset_id: asset.id,
    media_url: buildPublicMediaUrl(asset.id),
    status: asset.status || 'ready',
    mime_type: asset.mime_type,
    media_type: mediaType,
    size_bytes: asset.size_bytes,
    width: asset.width,
    height: asset.height,
  };
}

const INTERNAL_MEDIA_KEYS = new Set([
  'storage_url',
  'public_url',
  'storage_path',
  'signed_url',
  'internal_url',
  'provider',
  'checksum',
  'checksum_sha256',
]);

/** Remove backend storage details from MCP/user-facing objects. */
export function stripInternalMediaFields<T extends Record<string, unknown>>(payload: T): T {
  const clone = { ...payload } as Record<string, unknown>;
  for (const key of INTERNAL_MEDIA_KEYS) {
    delete clone[key];
  }
  if (typeof clone.asset === 'object' && clone.asset) {
    clone.asset = sanitizeMediaForClient(clone.asset as Parameters<typeof sanitizeMediaForClient>[0]);
  }
  const assetId =
    (typeof clone.media_asset_id === 'string' && clone.media_asset_id) ||
    (typeof clone.media_id === 'string' && clone.media_id) ||
    (typeof clone.asset_id === 'string' && clone.asset_id) ||
    null;
  if (assetId && isValidMediaAssetId(assetId)) {
    clone.media_asset_id = assetId;
    clone.media_url = buildPublicMediaUrl(assetId);
  } else if (typeof clone.media_url === 'string' && isSupabaseStorageUrl(clone.media_url)) {
    delete clone.media_url;
  }
  if (typeof clone.live_url === 'string' && isSupabaseStorageUrl(clone.live_url)) {
    delete clone.live_url;
  }
  return clone as T;
}

/** Recursively redact Supabase storage URLs from JSON-safe values. */
export function redactSupabaseUrlsDeep(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return isSupabaseStorageUrl(value) ? '[REDACTED_STORAGE_URL]' : value;
  }
  if (Array.isArray(value)) return value.map(redactSupabaseUrlsDeep);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (INTERNAL_MEDIA_KEYS.has(k)) continue;
      out[k] = redactSupabaseUrlsDeep(v);
    }
    return out;
  }
  return value;
}
