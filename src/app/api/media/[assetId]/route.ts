import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { hasStoragePathTraversal } from '@/lib/security/safeRedirect';
import { isValidMediaAssetId } from '@/lib/media/mediaPublicUrl';
import { NextResponse } from 'next/server';

const CACHE_MAX_AGE = 3600;
const SIGNED_URL_TTL_SEC = 300;

type MediaAssetRow = {
  id: string;
  tenant_id: string;
  storage_path: string | null;
  file_type: string | null;
  file_name: string | null;
  deleted_at?: string | null;
};

async function loadMediaAsset(assetId: string): Promise<MediaAssetRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('media_assets')
    .select('id, tenant_id, storage_path, file_type, file_name, deleted_at')
    .eq('id', assetId)
    .maybeSingle();
  if (error || !data || data.deleted_at) return null;
  return data as MediaAssetRow;
}

function securityHeaders(mimeType: string): HeadersInit {
  return {
    'Content-Type': mimeType,
    'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=600`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  };
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

  const asset = await loadMediaAsset(assetId);
  if (!asset?.storage_path) {
    return new NextResponse('Not found', { status: 404 });
  }

  const pathParts = asset.storage_path.split('/');
  if (hasStoragePathTraversal(pathParts)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const optionalTenant = new URL(request.url).searchParams.get('tenant_id');
  if (optionalTenant && optionalTenant !== asset.tenant_id) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const mimeType = asset.file_type || 'application/octet-stream';

  const { data: signed, error: signErr } = await admin.storage
    .from('public-assets')
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SEC);

  if (!signErr && signed?.signedUrl) {
    const upstream = await fetch(signed.signedUrl, { redirect: 'follow' });
    if (upstream.ok && upstream.body) {
      return new NextResponse(upstream.body, {
        status: 200,
        headers: securityHeaders(upstream.headers.get('content-type') || mimeType),
      });
    }
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from('public-assets')
    .download(asset.storage_path);

  if (dlErr || !blob) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  return new NextResponse(buffer, {
    status: 200,
    headers: securityHeaders(mimeType),
  });
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
