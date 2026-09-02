import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { hasStoragePathTraversal } from '@/lib/security/safeRedirect';
import { isValidMediaAssetId } from '@/lib/media/mediaPublicUrl';
import { loadMediaAssetRecord } from '@/lib/media/fetchMediaAssetBytes';
import { NextResponse } from 'next/server';

const CACHE_MAX_AGE = 3600;
const DEFAULT_BUCKET = 'public-assets';

function storagePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${DEFAULT_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

function securityHeaders(mimeType: string, contentLength?: number): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=600`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Access-Control-Allow-Origin': '*',
  };
  if (contentLength != null) {
    headers['Content-Length'] = String(contentLength);
  }
  return headers;
}

async function streamAssetBytes(asset: NonNullable<Awaited<ReturnType<typeof loadMediaAssetRecord>>>) {
  const storagePath =
    asset.storage_path ||
    (asset.public_url ? storagePathFromPublicUrl(asset.public_url) : null);
  if (!storagePath) return null;

  const pathParts = storagePath.split('/');
  if (hasStoragePathTraversal(pathParts)) return null;

  const admin = createSupabaseAdminClient();
  const mimeType = asset.file_type || 'application/octet-stream';

  const { data: signed, error: signErr } = await admin.storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(storagePath, 300);

  if (!signErr && signed?.signedUrl) {
    const upstream = await fetch(signed.signedUrl, { redirect: 'follow' });
    if (upstream.ok && upstream.body) {
      const len = upstream.headers.get('content-length');
      return new NextResponse(upstream.body, {
        status: 200,
        headers: securityHeaders(upstream.headers.get('content-type') || mimeType, len ? Number(len) : undefined),
      });
    }
  }

  const { data: blob, error: dlErr } = await admin.storage.from(DEFAULT_BUCKET).download(storagePath);
  if (dlErr || !blob) return null;

  const buffer = Buffer.from(await blob.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: securityHeaders(mimeType, buffer.length),
  });
}

/**
 * Public media proxy — opaque asset UUID, no tenant/bucket/path in URL.
 * Facebook/LinkedIn and MCP clients use this instead of raw Supabase URLs.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId: rawId } = await params;
  const assetId = decodeURIComponent(String(rawId || '').trim());

  if (!isValidMediaAssetId(assetId)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const asset = await loadMediaAssetRecord(assetId);
  if (!asset) {
    return new NextResponse('Not found', { status: 404 });
  }

  const optionalTenant = new URL(request.url).searchParams.get('tenant_id');
  if (optionalTenant && optionalTenant !== asset.tenant_id) {
    return new NextResponse('Not found', { status: 404 });
  }

  const response = await streamAssetBytes(asset);
  if (!response) {
    return new NextResponse('Not found', { status: 404 });
  }
  return response;
}

/** HEAD for reachability checks (Facebook/LinkedIn prefetch). */
export async function HEAD(
  request: Request,
  ctx: { params: Promise<{ assetId: string }> }
) {
  const response = await GET(request, ctx);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
