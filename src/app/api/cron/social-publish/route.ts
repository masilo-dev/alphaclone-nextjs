import { NextRequest, NextResponse } from "next/server";
import { denyIfCronUnauthorized } from "@/lib/cronAuth";
import { withCronJob } from "@/lib/cron/withCronJob";
import {
  publishDueSocialPostSummary,
  publishScheduledPosts,
} from "@/lib/social/cronPublish";

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob("social-publish", async () => {
    try {
      const { buildCronExecutionContext } = await import(
        '@/lib/execution/cronExecutionContext'
      );
      // Declares cron as execution source for observability; SPS processDue uses domain command with executionSource=cron.
      void buildCronExecutionContext({
        jobName: 'social-publish',
        tenantId: 'system',
        capability: 'publish_social_post',
      });
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
        execution_source: 'cron',
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
  });
}
