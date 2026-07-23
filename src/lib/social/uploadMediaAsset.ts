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

/**
 * Upload binary media when the caller provides base64.
 * No size cap and no MIME allowlist — external AI/video tools (Kling, etc.)
 * may produce any media type. Prefer passing external media_urls to create_post
 * when the content already lives on another host (no re-upload required).
 */
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

  // No size/type restriction — accept image, video, and any other media MIME.
  const isVideo = mimeType.startsWith('video/');
  const assetType = isVideo ? 'video' : mimeType.includes('gif') ? 'gif' : mimeType.startsWith('image/') ? 'image' : 'file';
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

/**
 * Validate that an external media URL is reachable before posting.
 * Surfaces clear errors instead of silently posting a broken link.
 */
export async function assertMediaUrlReachable(
  url: string,
  options?: { timeoutMs?: number }
): Promise<{ ok: true; contentType: string | null; status: number } | never> {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    throw new Error('media_url is empty');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid media_url: ${trimmed}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported media_url protocol: ${parsed.protocol}`);
  }

  const timeoutMs = options?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(trimmed, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    // Some CDNs reject HEAD — fall back to ranged GET
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(trimmed, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal,
      });
    }
    if (!res.ok && res.status !== 206) {
      throw new Error(
        `Media URL unreachable (HTTP ${res.status}): ${trimmed}. Provide a publicly reachable URL from the AI/content tool.`
      );
    }
    return {
      ok: true,
      contentType: res.headers.get('content-type'),
      status: res.status,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Media URL timed out after ${timeoutMs}ms: ${trimmed}`);
    }
    if (err?.message?.includes('Media URL')) throw err;
    throw new Error(`Media URL fetch failed: ${trimmed} (${err?.message || 'unknown error'})`);
  } finally {
    clearTimeout(timer);
  }
}
