/**
 * Production media ingestion used by social, email attachments, and MCP tools.
 * Wraps hardened social upload + tenant-scoped asset resolution.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  isDataUri,
  rejectOrExtractDataUri,
  uploadSocialMedia,
  assertPublicMediaUrl,
} from '@/lib/social/mediaUpload';
import type { IngestedMediaAsset, MediaInput } from './types';

function toIngested(row: {
  media_asset_id: string;
  public_url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  checksum?: string | null;
}): IngestedMediaAsset {
  return {
    id: row.media_asset_id,
    filename: row.filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    url: row.public_url,
    status: 'ready',
    width: row.width ?? null,
    height: row.height ?? null,
    checksum: row.checksum ?? null,
  };
}

async function loadAssetForTenant(
  tenantId: string,
  assetId: string
): Promise<IngestedMediaAsset> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('media_assets')
    .select('id, public_url, file_name, file_type, file_size_bytes, width, height, checksum_sha256, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('id', assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`media_asset_id not found for tenant: ${assetId}`);
  if (data.tenant_id !== tenantId) throw new Error('Cross-tenant media access denied');
  if (!data.public_url || isDataUri(data.public_url)) {
    throw new Error(`media_asset ${assetId} has no provider-fetchable URL`);
  }
  return {
    id: data.id,
    filename: data.file_name || 'asset',
    mime_type: data.file_type || 'application/octet-stream',
    size_bytes: data.file_size_bytes || 0,
    url: data.public_url,
    status: 'ready',
    width: data.width,
    height: data.height,
    checksum: data.checksum_sha256,
  };
}

async function downloadRemoteUrl(url: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported media_url protocol: ${parsed.protocol}`);
  }
  assertPublicMediaUrl(parsed);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'image/*,video/*,application/octet-stream' },
    });
    if (!res.ok) throw new Error(`Failed to download media_url (${res.status})`);
    const contentType = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    const pathName = parsed.pathname.split('/').pop() || 'remote-media';
    return { buffer, mimeType: contentType, filename: pathName };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ingest one MediaInput into a tenant-scoped media_assets record.
 */
export async function ingestMediaInput(params: {
  tenantId: string;
  userId: string;
  media: MediaInput;
  purpose?: string;
}): Promise<IngestedMediaAsset> {
  const { tenantId, userId, media } = params;

  switch (media.type) {
    case 'asset_id':
      return loadAssetForTenant(tenantId, media.assetId);

    case 'base64': {
      const uploaded = await uploadSocialMedia({
        tenantId,
        userId,
        filename: media.filename,
        mimeType: media.mimeType,
        contentBase64: media.data,
      });
      return toIngested(uploaded);
    }

    case 'data_url': {
      const extracted = rejectOrExtractDataUri(media.dataUrl);
      if (!extracted.isDataUri || !extracted.base64) {
        throw new Error('Invalid data_url');
      }
      const mime = extracted.mimeType || 'image/png';
      const filename =
        media.filename ||
        `generated.${mime.includes('jpeg') ? 'jpg' : mime.split('/')[1] || 'png'}`;
      const uploaded = await uploadSocialMedia({
        tenantId,
        userId,
        filename,
        mimeType: mime,
        contentBase64: extracted.base64,
      });
      return toIngested(uploaded);
    }

    case 'url': {
      if (isDataUri(media.url)) {
        return ingestMediaInput({
          tenantId,
          userId,
          media: { type: 'data_url', dataUrl: media.url, filename: media.filename },
          purpose: params.purpose,
        });
      }
      const remote = await downloadRemoteUrl(media.url);
      const uploaded = await uploadSocialMedia({
        tenantId,
        userId,
        filename: media.filename || remote.filename,
        mimeType: remote.mimeType.startsWith('image/') || remote.mimeType.startsWith('video/')
          ? remote.mimeType
          : 'image/png',
        contentBase64: remote.buffer.toString('base64'),
      });
      return toIngested(uploaded);
    }

    case 'storage_path': {
      const supabase = createSupabaseAdminClient();
      // Tenant must own the path prefix
      if (!media.path.includes(tenantId)) {
        throw new Error('storage_path is not tenant-scoped');
      }
      const { data, error } = await supabase.storage.from(media.bucket).download(media.path);
      if (error || !data) throw new Error(error?.message || 'Failed to download storage object');
      const buffer = Buffer.from(await data.arrayBuffer());
      const filename = media.path.split('/').pop() || 'storage-object';
      const uploaded = await uploadSocialMedia({
        tenantId,
        userId,
        filename,
        mimeType: data.type || 'image/png',
        contentBase64: buffer.toString('base64'),
      });
      return toIngested(uploaded);
    }

    case 'document_id': {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from('file_uploads')
        .select('id, tenant_id, file_name, mime_type, storage_path, bucket, public_url')
        .eq('tenant_id', tenantId)
        .eq('id', media.documentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`document_id not found for tenant: ${media.documentId}`);
      if (data.public_url && !isDataUri(data.public_url)) {
        return ingestMediaInput({
          tenantId,
          userId,
          media: { type: 'url', url: data.public_url, filename: data.file_name || undefined },
          purpose: params.purpose,
        });
      }
      if (data.bucket && data.storage_path) {
        return ingestMediaInput({
          tenantId,
          userId,
          media: { type: 'storage_path', bucket: data.bucket, path: data.storage_path },
          purpose: params.purpose,
        });
      }
      throw new Error('document has no downloadable storage reference');
    }

    default:
      throw new Error(`Unsupported media input type`);
  }
}

/**
 * Normalize legacy media_urls / media_asset_ids / media[] into ingested assets.
 */
export async function ingestPublishMedia(params: {
  tenantId: string;
  userId: string;
  media?: MediaInput[];
  mediaUrls?: string[];
  mediaAssetIds?: string[];
}): Promise<{ urls: string[]; assetIds: string[]; assets: IngestedMediaAsset[] }> {
  const assets: IngestedMediaAsset[] = [];
  const inputs: MediaInput[] = [];

  if (Array.isArray(params.media)) {
    for (const item of params.media) {
      if (!item || typeof item !== 'object') continue;
      // Accept snake_case variants from MCP clients (loose bag — MediaInput intersection
      // collapses discriminant fields under TypeScript).
      const raw = item as Record<string, unknown>;
      const type = typeof raw.type === 'string' ? raw.type : undefined;
      if (type === 'asset_id' || typeof raw.asset_id === 'string' || typeof raw.assetId === 'string') {
        inputs.push({
          type: 'asset_id',
          assetId: String(raw.assetId || raw.asset_id),
        });
      } else if (type === 'base64' || typeof raw.data === 'string') {
        inputs.push({
          type: 'base64',
          data: String(raw.data),
          mimeType: String(raw.mimeType || raw.mime_type || 'image/png'),
          filename: String(raw.filename || 'upload.png'),
        });
      } else if (type === 'data_url' || typeof raw.data_url === 'string' || typeof raw.dataUrl === 'string') {
        inputs.push({
          type: 'data_url',
          dataUrl: String(raw.dataUrl || raw.data_url),
          filename: typeof raw.filename === 'string' ? raw.filename : undefined,
        });
      } else if (type === 'url' || typeof raw.url === 'string') {
        inputs.push({
          type: 'url',
          url: String(raw.url),
          filename: typeof raw.filename === 'string' ? raw.filename : undefined,
        });
      } else if (type === 'document_id' || typeof raw.document_id === 'string' || typeof raw.documentId === 'string') {
        inputs.push({
          type: 'document_id',
          documentId: String(raw.documentId || raw.document_id),
        });
      } else if (type === 'storage_path' || typeof raw.storage_path === 'string' || typeof raw.path === 'string') {
        inputs.push({
          type: 'storage_path',
          bucket: String(raw.bucket || raw.storage_bucket || 'public-assets'),
          path: String(raw.path || raw.storage_path),
        });
      }
    }
  }

  for (const id of params.mediaAssetIds || []) {
    if (id) inputs.push({ type: 'asset_id', assetId: id });
  }
  for (const url of params.mediaUrls || []) {
    if (!url) continue;
    if (isDataUri(url)) inputs.push({ type: 'data_url', dataUrl: url });
    else inputs.push({ type: 'url', url });
  }

  for (const media of inputs) {
    assets.push(await ingestMediaInput({ tenantId: params.tenantId, userId: params.userId, media }));
  }

  return {
    urls: assets.map((a) => a.url),
    assetIds: assets.map((a) => a.id),
    assets,
  };
}
