import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { xService } from '@/services/xService';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);
    const integration = await xService.getXIntegration(tenantId);
    if (!integration) {
      return NextResponse.json({ success: true, connected: false, data: null });
    }
    const data = await xService.getUserTweets(tenantId);
    return NextResponse.json({ success: true, connected: true, data });
  } catch (err) {
    if (err instanceof Error && err.message === 'X_API_CREDITS_DEPLETED') {
      return NextResponse.json({
        success: false,
        connected: true,
        creditsDepleted: true,
        error: 'Your X developer account has no API credits. Add credits at developer.x.com to load tweets.',
      }, { status: 402 });
    }
    return routeErrorResponse(err, 'Failed to load X timeline', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, text, mediaIds } = await req.json();
    if (!tenantId || !text?.trim()) {
      return NextResponse.json({ error: 'tenantId and text are required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);
    const result = await xService.postTweet(tenantId, {
      text: String(text).trim(),
      media_ids: Array.isArray(mediaIds) ? mediaIds : undefined,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    if (err instanceof Error && err.message === 'X_API_CREDITS_DEPLETED') {
      return NextResponse.json({
        success: false,
        creditsDepleted: true,
        error: 'Your X developer account has no API credits. Add credits at developer.x.com to post tweets.',
      }, { status: 402 });
    }
    return routeErrorResponse(err, 'Failed to post to X', req);
  }
}
