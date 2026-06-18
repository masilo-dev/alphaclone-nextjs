import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { publishDueLinkedInPosts } from '@/lib/social/cronPublish';

export const dynamic = 'force-dynamic';

/**
 * Cron job that publishes due LinkedIn posts specifically.
 * Runs every 15 minutes as defined in vercel.json.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const count = await publishDueLinkedInPosts(25);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      linkedin_posts_published: count,
    });
  } catch (error) {
    console.error('[cron/publish-linkedin] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
