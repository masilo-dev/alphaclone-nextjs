import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { isAllowedProxyImageUrl } from '@/lib/email/proxyImageUrl';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function normalizeContentType(value: string | null): string | null {
  if (!value) return null;
  const base = value.split(';')[0]?.trim().toLowerCase();
  return base || null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuthenticatedUser();

    const rawUrl = req.nextUrl.searchParams.get('url');
    if (!rawUrl) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    if (!isAllowedProxyImageUrl(rawUrl)) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(rawUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'AlphaCloneEmailImageProxy/1.0',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: upstream.status });
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    const contentType = normalizeContentType(upstream.headers.get('content-type'));
    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to proxy image', req);
  }
}
