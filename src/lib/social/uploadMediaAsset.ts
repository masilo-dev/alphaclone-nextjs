import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type UploadMediaAssetInput = {
  tenantId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  fileBase64: string;
  altText?: string;
  tags?: string[];
};

export type UploadedMediaAsset = {
  id: string;
  public_url: string;
  asset_type: string;
  file_name: string;
  file_size_bytes: number;
  created_at: string;
};

export async function uploadMediaAsset(input: UploadMediaAssetInput): Promise<UploadedMediaAsset> {
  const { tenantId, userId, fileName, mimeType, fileBase64, altText = '', tags = [] } = input;

  if (!fileName.trim()) throw new Error('file_name is required');
  if (!mimeType.trim()) throw new Error('mime_type is required');
  if (!fileBase64.trim()) throw new Error('file_base64 is required');

  const normalizedBase64 = fileBase64.includes('base64,')
    ? fileBase64.split('base64,')[1]
    : fileBase64;
  const binary = Buffer.from(normalizedBase64, 'base64');
  if (!binary.length) throw new Error('file_base64 is invalid or empty');

  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  if (!isVideo && !isImage) {
    throw new Error('Unsupported media type. Only image/* or video/* is allowed.');
  }

  const maxBytes = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
  if (binary.length > maxBytes) {
    throw new Error(`Media exceeds max size of ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  const assetType = isVideo ? 'video' : mimeType.includes('gif') ? 'gif' : 'image';
  const ext = fileName.split('.').pop() || (isVideo ? 'mp4' : 'bin');
  const storagePath = `media/${tenantId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from('public-assets')
    .upload(storagePath, binary, {
      contentType: mimeType,
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  const { data: asset, error: assetErr } = await supabase
    .from('media_assets')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      file_name: fileName.trim(),
      file_type: mimeType.trim(),
      asset_type: assetType,
      storage_path: storagePath,
      public_url: publicUrl,
      file_size_bytes: binary.length,
      alt_text: altText,
      tags: tags.filter((t) => typeof t === 'string'),
    })
    .select('id, public_url, asset_type, file_name, file_size_bytes, created_at')
    .single();

  if (assetErr) throw new Error(assetErr.message);
  return asset as UploadedMediaAsset;
}
