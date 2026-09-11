/**
 * Durable Social Publisher Engine
 * Enqueues checkpointed social publish tasks on the Bonnie durable runtime.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isDurableRuntimeEnabled } from "@/lib/bonnie/runtime/types";
import { enqueueSocialPublishTask } from "@/lib/social/socialPublishDurableTask";

export type SocialPublishResult = {
  ok: boolean;
  platform: string;
  externalId?: string | null;
  reason?: string;
};

export async function publishSocialPostDurable(
  postId: string,
  options?: { userId?: string; actionId?: string; idempotencyKey?: string }
): Promise<{
  success: boolean;
  runId?: string;
  taskId?: string;
  error?: string;
}> {
  if (!isDurableRuntimeEnabled()) {
    const { publishSocialPost } = await import("@/lib/social/cronPublish");
    try {
      await publishSocialPost(postId);
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "publish_failed",
      };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data: post } = await adminClient
    .from("social_posts")
    .select("id, tenant_id, user_id, status, linkedin_post_urn, facebook_post_id, instagram_post_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return { success: false, error: "post_not_found" };
  }

  if (
    post.status === "published" ||
    post.linkedin_post_urn ||
    post.facebook_post_id ||
    post.instagram_post_id
  ) {
    return { success: true };
  }

  try {
    const enqueued = await enqueueSocialPublishTask({
      tenantId: post.tenant_id,
      userId: options?.userId || post.user_id,
      postId: post.id,
      actionId: options?.actionId,
      idempotencyKey: options?.idempotencyKey,
    });
    return { success: true, runId: enqueued.runId, taskId: enqueued.taskId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "enqueue_failed",
    };
  }
}
