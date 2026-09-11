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
};

export async function loadMediaAssetRecord(assetId: string): Promise<MediaAssetRow | null> {
  if (!isValidMediaAssetId(assetId)) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('media_assets')
    .select('id, tenant_id, storage_path, file_type, file_name, public_url')
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

/** Load raw media bytes for provider publish (Facebook multipart upload). */
export async function fetchMediaAssetBytes(assetId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  filename: string;
  tenantId: string;
} | null> {
  const asset = await loadMediaAssetRecord(assetId);
  if (!asset) return null;

  const storagePath =
    asset.storage_path ||
    (asset.public_url ? storagePathFromPublicUrl(asset.public_url) : null);
  if (!storagePath) return null;

  const buffer = await downloadFromStorage(storagePath);
  if (!buffer?.length) return null;

  return {
    buffer,
    mimeType: asset.file_type || 'application/octet-stream',
    filename: asset.file_name || `${assetId}.bin`,
    tenantId: asset.tenant_id,
  };
}
