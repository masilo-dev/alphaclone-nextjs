import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { hasStoragePathTraversal } from '@/lib/security/safeRedirect';
import { isValidMediaAssetId } from '@/lib/media/mediaPublicUrl';

const DEFAULT_BUCKET = 'public-assets';

type MediaAssetRow = {
  id: string;
  tenant_id: string;
  storage_path: string | null;
  file_type: string | null;
  file_name: string | null;
  public_url: string | null;
  file_size_bytes: number | null;
  checksum_sha256: string | null;
  status: string | null;
};

export async function loadMediaAssetRecord(assetId: string): Promise<MediaAssetRow | null> {
  if (!isValidMediaAssetId(assetId)) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('media_assets')
    .select('id, tenant_id, storage_path, file_type, file_name, public_url, file_size_bytes, checksum_sha256, status')
    .eq('id', assetId)
    .maybeSingle();
  if (error || !data) return null;
  return data as MediaAssetRow;
}

function storagePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = '/storage/v1/object/public/public-assets/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

async function downloadFromStorage(storagePath: string): Promise<Buffer | null> {
  const pathParts = storagePath.split('/');
  if (hasStoragePathTraversal(pathParts)) return null;

  const admin = createSupabaseAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(storagePath, 300);
  if (!signErr && signed?.signedUrl) {
    const upstream = await fetch(signed.signedUrl, { redirect: 'follow' });
    if (upstream.ok) {
      return Buffer.from(await upstream.arrayBuffer());
    }
  }

  const { data: blob, error: dlErr } = await admin.storage.from(DEFAULT_BUCKET).download(storagePath);
  if (dlErr || !blob) return null;
  return Buffer.from(await blob.arrayBuffer());
}

async function markAssetFailed(
  asset: MediaAssetRow,
  failureCode: string,
  failureMessage: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('media_assets')
    .update({
      status: 'failed',
      failure_code: failureCode,
      failure_message: failureMessage,
    })
    .eq('tenant_id', asset.tenant_id)
    .eq('id', asset.id);
}

async function verifyStoredMediaIntegrity(asset: MediaAssetRow, buffer: Buffer): Promise<boolean> {
  if (asset.file_size_bytes && buffer.length !== asset.file_size_bytes) {
    await markAssetFailed(
      asset,
      'MEDIA_STORAGE_INTEGRITY_FAILED',
      `Stored byte count mismatch: expected ${asset.file_size_bytes}, got ${buffer.length}`
    );
    return false;
  }

  if (asset.checksum_sha256) {
    const checksum = createHash('sha256').update(buffer).digest('hex');
    if (checksum !== asset.checksum_sha256) {
      await markAssetFailed(
        asset,
        'MEDIA_STORAGE_INTEGRITY_FAILED',
        'Stored checksum differs from media record'
      );
      return false;
    }
  }

  const mimeType = String(asset.file_type || '').toLowerCase();
  if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
    try {
      const { default: sharp } = await import('sharp');
      const metadata = await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      }).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('missing image dimensions');
      }
      await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      })
        .resize({ width: 1, height: 1 })
        .raw()
        .toBuffer();
    } catch (error) {
      await markAssetFailed(
        asset,
        'MEDIA_CORRUPT',
        error instanceof Error
          ? `Stored image cannot be decoded: ${error.message}`
          : 'Stored image cannot be decoded'
      );
      return false;
    }
  }

  return true;
}

/** Load raw media bytes for provider publish (Facebook multipart upload). */
export async function fetchMediaAssetBytes(assetId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  filename: string;
  tenantId: string;
} | null> {
  const asset = await loadMediaAssetRecord(assetId);
  if (!asset) return null;
  if (asset.status && asset.status !== 'ready') return null;

  const storagePath =
    asset.storage_path ||
    (asset.public_url ? storagePathFromPublicUrl(asset.public_url) : null);
  if (!storagePath) {
    await markAssetFailed(
      asset,
      'MEDIA_STORAGE_REFERENCE_MISSING',
      'Media asset has no usable storage path'
    );
    return null;
  }

  const buffer = await downloadFromStorage(storagePath);
  if (!buffer?.length) {
    await markAssetFailed(
      asset,
      'MEDIA_PUBLIC_FETCH_FAILED',
      'Stored object is unavailable or empty'
    );
    return null;
  }

  const verified = await verifyStoredMediaIntegrity(asset, buffer);
  if (!verified) return null;

  return {
    buffer,
    mimeType: asset.file_type || 'application/octet-stream',
    filename: asset.file_name || `${assetId}.bin`,
    tenantId: asset.tenant_id,
  };
}
