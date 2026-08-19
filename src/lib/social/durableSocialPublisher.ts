/**
 * Durable Social Publisher Engine
 * Wraps social media post publishing in the PostgreSQL-backed agent_tasks DAG durable runtime.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createRunForObjective } from "@/lib/bonnie/runtime/goalRunService";
import {
  beginIdempotentAction,
  completeIdempotentAction,
  saveExternalReference,
  buildIdempotencyKey,
} from "@/lib/bonnie/runtime/idempotencyService";
import { insertOutboxEvent } from "@/lib/bonnie/runtime/outboxService";
import { eventBus } from "@/lib/engine/eventBus";

export type SocialPublishResult = {
  ok: boolean;
  platform: string;
  externalId?: string | null;
  reason?: string;
};

export async function publishSocialPostDurable(postId: string): Promise<{
  success: boolean;
  runId?: string;
  taskId?: string;
  error?: string;
}> {
  const adminClient = createSupabaseAdminClient();

  const { data: post } = await adminClient
    .from("social_posts")
    .select("id, tenant_id, status, platforms, linkedin_post_urn, facebook_post_id, instagram_post_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    return { success: false, error: "post_not_found" };
  }

  // Idempotency check: if already published or external ID exists, skip reposting
  if (post.status === "published" || post.linkedin_post_urn || post.facebook_post_id || post.instagram_post_id) {
    return { success: true };
  }

  // Create or retrieve durable run
  const runResult = await createRunForObjective({
    tenantId: post.tenant_id,
    objective: `Publish Social Post ${post.id}`,
    executionMode: "autonomous",
    successCriteria: { postId: post.id },
    seedGraph: true,
  });

  const runId = runResult.run.id;
  const idempotencyKey = buildIdempotencyKey({
    tenantId: post.tenant_id,
    taskId: `social-${post.id}`,
    actionType: "social.publish",
    targetRecordId: post.id,
    actionVersion: 1,
  });

  // Check idempotent action status
  const gate = await beginIdempotentAction({
    tenantId: post.tenant_id,
    key: idempotencyKey,
    taskId: `social-${post.id}`,
    attemptId: `att-${Date.now()}`,
    actionType: "social.publish",
  });

  if (!gate.proceed && gate.existing?.state === "completed") {
    console.log(`[DurableSocialPublisher] Post ${post.id} already published (idempotency key matched)`);
    return { success: true, runId };
  }

  // Lock status to publishing
  await adminClient
    .from("social_posts")
    .update({ status: "publishing", error_message: null })
    .eq("id", postId)
    .eq("tenant_id", post.tenant_id);

  // Import publish handler dynamically to avoid circular dependencies
  const { publishSocialPost: legacyPublish } = await import("@/lib/social/cronPublish");

  try {
    await legacyPublish(postId);

    // Verify side effect: check if post transitioned to published
    const { data: updatedPost } = await adminClient
      .from("social_posts")
      .select("status, facebook_post_id, linkedin_post_urn, instagram_post_id, error_message")
      .eq("id", postId)
      .single();

    const externalRef =
      updatedPost?.facebook_post_id ||
      updatedPost?.linkedin_post_urn ||
      updatedPost?.instagram_post_id ||
      null;

    if (updatedPost?.status === "published") {
      await completeIdempotentAction({
        tenantId: post.tenant_id,
        key: idempotencyKey,
        result: { status: "published", externalRef },
        providerReference: externalRef || undefined,
      });

      if (externalRef) {
        await saveExternalReference({
          tenantId: post.tenant_id,
          taskId: `social-${post.id}`,
          attemptId: `att-${Date.now()}`,
          provider: "social_network",
          referenceType: "external_post_id",
          referenceId: externalRef,
          payload: { postId: post.id },
        });
      }

      // Emit domain event for multi-agent outbox integration
      await insertOutboxEvent({
        tenantId: post.tenant_id,
        eventType: "social.post.published",
        payload: { postId: post.id, externalRef, tenantId: post.tenant_id },
      });

      await eventBus.emit({
        tenant_id: post.tenant_id,
        event_type: "social.post.published",
        aggregate_type: "social_post",
        aggregate_id: post.id,
        payload: { postId: post.id, externalRef },
        actor_type: "agent",
      });

      return { success: true, runId };
    } else {
      return {
        success: false,
        runId,
        error: updatedPost?.error_message || "Social post publish failed during execution",
      };
    }
  } catch (err: any) {
    console.error(`[DurableSocialPublisher] Error executing post ${postId}:`, err);
    await adminClient
      .from("social_posts")
      .update({ status: "failed", error_message: err?.message || "Durable execution failed" })
      .eq("id", postId)
      .eq("tenant_id", post.tenant_id);

    return { success: false, runId, error: err?.message || "Execution failed" };
  }
}
