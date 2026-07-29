import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
<<<<<<< HEAD
import { publishDueSocialPosts, publishScheduledPosts } from '@/lib/social/cronPublish';
=======
import { publishDueSocialPosts } from '@/lib/social/cronPublish';
>>>>>>> origin/main

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
<<<<<<< HEAD
    // Canonical publisher only (social_posts). Legacy scheduled_posts dual-path is
    // opt-in via SOCIAL_LEGACY_SCHEDULED_POSTS=true to avoid duplicate publishes.
    const publishedCount = await publishDueSocialPosts();
    let scheduledPublishedCount = 0;
    if (
      process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === 'true' ||
      process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === '1'
    ) {
      scheduledPublishedCount = await publishScheduledPosts();
    }
=======
    const publishedCount = await publishDueSocialPosts();
>>>>>>> origin/main

    return NextResponse.json({
      success: true,
      publishedCount,
<<<<<<< HEAD
      scheduledPublishedCount,
      totalCount: publishedCount + scheduledPublishedCount,
      legacyScheduledPostsEnabled:
        process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === 'true' ||
        process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === '1',
      timestamp: new Date().toISOString(),
=======
      timestamp: new Date().toISOString()
>>>>>>> origin/main
    });
  } catch (err: unknown) {
    console.error('[cron/social-publish] failed to trigger workflow:', err);
    return NextResponse.json({ success: false, error: 'Failed to trigger workflow' }, { status: 500 });
  }
}

