import { NextResponse } from 'next/server';
import { fetchMediaAssetBytes } from '@/lib/media/fetchMediaAssetBytes';
import { verifyProviderFetchToken } from '@/lib/media/providerFetchUrl';

const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';

async function serve({ params }: { params: Promise<{ token: string }> }, head = false) {
  const { token } = await params;
  const claims = verifyProviderFetchToken(decodeURIComponent(token));
  if (!claims) return new NextResponse('Not found', { status: 404 });
  const media = await fetchMediaAssetBytes(claims.asset_id);
  if (!media || media.tenantId !== claims.tenant_id) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(head ? null : media.buffer, {
    status: 200,
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(media.buffer.length),
      'Cache-Control': CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  return serve(context);
}

export async function HEAD(_request: Request, context: { params: Promise<{ token: string }> }) {
  return serve(context, true);
}
