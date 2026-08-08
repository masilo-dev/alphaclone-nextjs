import { NextRequest, NextResponse } from "next/server";
import { denyIfCronUnauthorized } from "@/lib/cronAuth";
import {
  publishDueSocialPostSummary,
  publishScheduledPosts,
} from "@/lib/social/cronPublish";

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    // Canonical publisher only (social_posts). Legacy scheduled_posts dual-path is
    // opt-in via SOCIAL_LEGACY_SCHEDULED_POSTS=true to avoid duplicate publishes.
    const publishSummary = await publishDueSocialPostSummary();
    let scheduledPublishedCount = 0;
    if (
      process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === "true" ||
      process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === "1"
    ) {
      scheduledPublishedCount = await publishScheduledPosts();
    }

    return NextResponse.json({
      success: true,
      publishedCount: publishSummary.processed,
      publishSummary,
      scheduledPublishedCount,
      totalCount: publishSummary.processed + scheduledPublishedCount,
      legacyScheduledPostsEnabled:
        process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === "true" ||
        process.env.SOCIAL_LEGACY_SCHEDULED_POSTS === "1",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[cron/social-publish] failed to trigger workflow:", err);
    return NextResponse.json(
      { success: false, error: "Failed to trigger workflow" },
      { status: 500 },
    );
  }
}
