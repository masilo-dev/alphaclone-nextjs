import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { publishDueSocialPosts } from '@/lib/social/cronPublish';

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const publishedCount = await publishDueSocialPosts();

    return NextResponse.json({
      success: true,
      publishedCount,
      timestamp: new Date().toISOString()
    });
  } catch (err: unknown) {
    console.error('[cron/social-publish] failed to trigger workflow:', err);
    return NextResponse.json({ success: false, error: 'Failed to trigger workflow' }, { status: 500 });
  }
}
