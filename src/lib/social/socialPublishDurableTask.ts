/**
 * Durable social publish tasks — checkpointed upload → publish → verify pipeline.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createRunForObjective } from '@/lib/bonnie/runtime/goalRunService';
import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { saveCheckpoint, getLatestCheckpoint } from '@/lib/bonnie/runtime/checkpointService';
import { beginIdempotentAction, completeIdempotentAction, buildIdempotencyKey } from '@/lib/bonnie/runtime/idempotencyService';
import { insertOutboxEvent } from '@/lib/bonnie/runtime/outboxService';
import { classifyRetryableExecutionError } from '@/lib/bonnie/runtime/retryPolicyRegistry';
import type { GraphTaskInput } from '@/lib/bonnie/runtime/types';

export type EnqueueSocialPublishInput = {
  tenantId: string;
  userId: string;
  postId: string;
  actionId?: string;
  idempotencyKey?: string;
};

export type EnqueueSocialPublishResult = {
  runId: string;
  taskId: string;
  graphId: string;
};

const SOCIAL_PUBLISH_STAGES = ['load_context', 'publish_provider', 'verify_receipt'] as const;

export async function enqueueSocialPublishTask(
  input: EnqueueSocialPublishInput
): Promise<EnqueueSocialPublishResult> {
  const admin = createSupabaseAdminClient();
  const objective = `Durable publish social post ${input.postId}`;

  const runResult = await createRunForObjective({
    tenantId: input.tenantId,
    userId: input.userId,
    objective,
    executionMode: 'autonomous',
    successCriteria: { postId: input.postId, requireProviderId: true },
    seedGraph: false,
  });

  const taskPayload: GraphTaskInput = {
    tempId: 't_social_publish',
    title: `Publish social post ${input.postId}`,
    taskType: 'social.publish',
    assignedAgentId: 'social',
    status: 'READY',
    riskLevel: 'high',
    structuredInput: {
      postId: input.postId,
      tenantId: input.tenantId,
      userId: input.userId,
      actionId: input.actionId || null,
      idempotencyKey: input.idempotencyKey || null,
    },
    retryPolicy: { maxAttempts: 5, backoffMs: 60_000 },
    metadata: { pipeline: SOCIAL_PUBLISH_STAGES },
  };

  const graph = await createGraphTransactional({
    tenantId: input.tenantId,
    runId: runResult.run.id,
    tasks: [taskPayload],
    reason: 'social_publish_enqueue',
    actorType: 'mcp',
    actorId: input.userId,
  });

  const taskId = graph.taskIds[0];
  if (!taskId) throw new Error('Failed to enqueue social publish task');

  await admin
    .from('social_posts')
    .update({
      status: 'queued',
      metadata: {
        durable_task_id: taskId,
        durable_run_id: runResult.run.id,
        action_id: input.actionId || null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.postId)
    .eq('tenant_id', input.tenantId);

  await insertOutboxEvent({
    tenantId: input.tenantId,
    eventType: 'social.publish.enqueued',
    payload: {
      task_id: taskId,
      run_id: runResult.run.id,
      post_id: input.postId,
      tenant_id: input.tenantId,
    },
    correlationId: input.actionId,
  });

  return { runId: runResult.run.id, taskId, graphId: graph.graphId };
}

export async function executeSocialPublishDurableTask(params: {
  tenantId: string;
  taskId: string;
  task: Record<string, unknown>;
  attemptId: string;
  fencingToken: string;
}): Promise<{ status: 'COMPLETED' | 'FAILED' | 'RETRY_SCHEDULED'; result?: Record<string, unknown>; error?: string }> {
  const admin = createSupabaseAdminClient();
  const input = (params.task.structured_input || {}) as Record<string, unknown>;
  const postId = String(input.postId || '');
  const userId = String(input.userId || '');
  if (!postId || !userId) {
    return { status: 'FAILED', error: 'social publish task missing postId or userId' };
  }

  const checkpoint = await getLatestCheckpoint(params.taskId, params.tenantId);
  const completedStage = checkpoint?.completed_stage || 'start';
  const stageIdx = Math.max(
    0,
    SOCIAL_PUBLISH_STAGES.indexOf(completedStage as (typeof SOCIAL_PUBLISH_STAGES)[number]) + 1
  );

  const intermediate: Record<string, unknown> = {
    ...(checkpoint?.intermediate_output || {}),
    postId,
  };

  const idempotencyKey =
    String(input.idempotencyKey || '') ||
    buildIdempotencyKey({
      tenantId: params.tenantId,
      taskId: params.taskId,
      actionType: 'social.publish',
      targetRecordId: postId,
      actionVersion: Number(params.task.attempt_count || 0),
    });

  for (let i = stageIdx; i < SOCIAL_PUBLISH_STAGES.length; i++) {
    const stage = SOCIAL_PUBLISH_STAGES[i];

    if (stage === 'load_context') {
      const { data: post } = await admin
        .from('social_posts')
        .select('id, tenant_id, status, caption, platforms, facebook_post_id, linkedin_post_urn, media_urls, metadata')
        .eq('id', postId)
        .eq('tenant_id', params.tenantId)
        .maybeSingle();
      if (!post) {
        return { status: 'FAILED', error: 'post_not_found' };
      }
      if (post.status === 'published' && (post.facebook_post_id || post.linkedin_post_urn)) {
        intermediate.alreadyPublished = true;
        intermediate.providerReference = post.facebook_post_id || post.linkedin_post_urn;
        await saveCheckpoint({
          tenantId: params.tenantId,
          taskId: params.taskId,
          attemptId: params.attemptId,
          completedStage: 'verify_receipt',
          intermediateOutput: intermediate,
        });
        break;
      }
      intermediate.post = post;
    }

    if (stage === 'publish_provider') {
      if (intermediate.alreadyPublished) continue;

      const gate = await beginIdempotentAction({
        tenantId: params.tenantId,
        key: idempotencyKey,
        taskId: params.taskId,
        attemptId: params.attemptId,
        actionType: 'social.publish',
      });
      if (!gate.proceed && gate.existing?.state === 'completed') {
        intermediate.idempotentReplay = true;
        intermediate.result = gate.existing.result;
      } else {
        await admin
          .from('social_posts')
          .update({ status: 'publishing', error_message: null })
          .eq('id', postId)
          .eq('tenant_id', params.tenantId);

        const { publishSocialPost } = await import('@/lib/social/cronPublish');
        await publishSocialPost(postId);

        const { data: updated } = await admin
          .from('social_posts')
          .select('status, facebook_post_id, linkedin_post_urn, live_url, error_message, published_at')
          .eq('id', postId)
          .maybeSingle();

        const providerRef = updated?.facebook_post_id || updated?.linkedin_post_urn || null;
        if (updated?.status !== 'published' || !providerRef) {
          const message = updated?.error_message || 'Provider publish did not complete';
          const classified = classifyRetryableExecutionError(message);
          await admin
            .from('social_posts')
            .update({ status: 'failed', error_message: message })
            .eq('id', postId)
            .eq('tenant_id', params.tenantId);
          return {
            status: classified.retryable ? 'RETRY_SCHEDULED' : 'FAILED',
            error: message,
          };
        }

        intermediate.result = {
          status: 'published',
          providerReference: providerRef,
          liveUrl: updated.live_url,
          publishedAt: updated.published_at,
        };
        await completeIdempotentAction({
          tenantId: params.tenantId,
          key: idempotencyKey,
          result: intermediate.result as Record<string, unknown>,
          providerReference: providerRef,
        });
      }
    }

    if (stage === 'verify_receipt') {
      const { getSocialPublishingService } = await import('@/lib/social/SocialPublishingService');
      const service = getSocialPublishingService();
      const verification = await service.verifyProviderPost({
        tenantId: params.tenantId,
        postId,
      });
      if (!verification.ok) {
        const classified = classifyRetryableExecutionError(
          verification.error || verification.error_code || 'verification_failed'
        );
        return {
          status: classified.retryable ? 'RETRY_SCHEDULED' : 'FAILED',
          error: verification.error || 'verification_failed',
        };
      }
      intermediate.verified = true;
      intermediate.verification = verification;
      intermediate.providerReference = verification.provider_post_id;
    }

    await saveCheckpoint({
      tenantId: params.tenantId,
      taskId: params.taskId,
      attemptId: params.attemptId,
      completedStage: stage,
      intermediateOutput: intermediate,
    });
  }

  await insertOutboxEvent({
    tenantId: params.tenantId,
    eventType: 'social.post.published',
    payload: {
      post_id: postId,
      task_id: params.taskId,
      provider_reference: intermediate.providerReference || (intermediate.result as any)?.providerReference,
    },
  });

  return { status: 'COMPLETED', result: intermediate as Record<string, unknown> };
}
