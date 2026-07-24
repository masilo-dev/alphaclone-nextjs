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
 * Delegates to hardened uploadSocialMedia (MIME allowlist, size limits,
 * signature verification, tenant-scoped storage, checksum).
 */
export async function uploadMediaAsset(input: UploadMediaAssetInput): Promise<UploadedMediaAsset> {
  const { uploadSocialMedia } = await import('@/lib/social/mediaUpload');
  const result = await uploadSocialMedia({
    tenantId: input.tenantId,
    userId: input.userId,
    filename: input.fileName,
    mimeType: input.mimeType,
    contentBase64: input.fileBase64,
    altText: input.altText,
  });
  return {
    id: result.media_asset_id,
    public_url: result.public_url,
    asset_type: result.mime_type.startsWith('video/')
      ? 'video'
      : result.mime_type.includes('gif')
        ? 'gif'
        : result.mime_type.startsWith('image/')
          ? 'image'
          : 'file',
    file_name: result.filename,
    file_size_bytes: result.size_bytes,
    created_at: new Date().toISOString(),
  };
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
