/**
 * Source-neutral social publish/schedule command.
 * UI, MCP, and cron call this; SocialPublishingService remains the only publisher.
 */

import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { executeDomainExternalWrite } from '@/lib/execution/domainExternalWrite';
import { guardDomainCapability } from '@/lib/execution/domainCapabilityGuard';
import { socialPublishIdempotencyKey } from '@/lib/execution/domainIdempotencyKeys';
import { domainResultFromGateway, type DomainExecutionResult } from '@/lib/execution/domainExecutionResult';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';
import type {
  PublishSocialPostInput,
  PublishSocialPostResult,
  SocialPlatform,
} from '@/lib/social/types';

export type SocialPublishCommandParams = {
  tenantId: string;
  userId: string;
  executionSource: PolicySource | 'api' | 'worker' | 'cron';
  skipPolicyEvaluation?: boolean;
  idempotencyKey?: string | null;
  /** Create + publish/schedule via SocialPublishingService.publish */
  create?: Omit<PublishSocialPostInput, 'tenantId' | 'userId' | 'idempotencyKey' | 'correlationId'>;
  /** Publish an existing scheduled/queued post (cron / publish_now on existing row) */
  existingPostId?: string;
  platformHint?: SocialPlatform;
  capability?: 'publish_social_post' | 'schedule_social_post';
};

function resolveSource(source: SocialPublishCommandParams['executionSource']): PolicySource {
  if (source === 'api') return 'ui';
  if (source === 'worker') return 'cron';
  return source as PolicySource;
}

export async function executeSocialPublishCommand(
  params: SocialPublishCommandParams
): Promise<DomainExecutionResult<PublishSocialPostResult>> {
  const executionSource = resolveSource(params.executionSource);
  const service = getSocialPublishingService();

  const platform = (params.create?.platform || params.platformHint || 'facebook') as SocialPlatform;
  const identityId = params.create?.identityId || params.existingPostId || 'unknown';
  const postKey = params.existingPostId || 'new';
  const destinationKey = `${platform}:${identityId}`;
  const idempotencyKey =
    params.idempotencyKey?.trim() ||
    socialPublishIdempotencyKey({
      tenantId: params.tenantId,
      postId: postKey,
      destinationKey,
    });

  const publishNow = params.create ? Boolean(params.create.publishNow) : true;
  const capability =
    params.capability || (publishNow || params.existingPostId ? 'publish_social_post' : 'schedule_social_post');

  const guard = await guardDomainCapability({
    tenantId: params.tenantId,
    userId: params.userId,
    capability,
    executionSource,
    args: {
      platform,
      identity_id: identityId,
      existing_post_id: params.existingPostId,
      publish_now: publishNow,
    },
    idempotencyKey,
    skipPolicyEvaluation: params.skipPolicyEvaluation,
  });

  if (!guard.allowed) {
    return {
      execution_id: '',
      status: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      verification_state: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      idempotency_key: idempotencyKey,
      execution_source: String(executionSource),
      ok: false,
      failure_code: guard.body.code,
      error: { code: guard.body.code as 'POLICY_BLOCKED', message: guard.body.error },
    };
  }

  const gateway = await executeDomainExternalWrite({
    tenantId: params.tenantId,
    userId: params.userId,
    capability,
    action: params.existingPostId ? 'social.publish_existing' : 'social.publish',
    mode: publishNow || params.existingPostId ? 'execute_now' : 'schedule',
    executionSource,
    idempotencyKey,
    target: {
      workspace_id: params.tenantId,
      integration: platform,
      identity_type: params.create?.identityType || null,
      identity_id: identityId,
      resource_type: 'social_post',
      resource_id: params.existingPostId || null,
    },
    payload: {
      platform,
      existingPostId: params.existingPostId,
      publishNow,
      caption: params.create?.caption?.slice(0, 200),
    },
    execute: async ({ actionId }): Promise<PublishSocialPostResult> => {
      if (params.existingPostId) {
        const provider = await service.publishExistingPost(params.existingPostId, params.tenantId);
        const providerPlatform = (provider.provider || platform) as SocialPlatform;
        const ok = Boolean(provider.ok && provider.verified && provider.provider_post_id);
        return {
          ok,
          data: {
            social_post_id: params.existingPostId,
            platform: providerPlatform,
            identity_type: params.create?.identityType || 'facebook_page',
            identity_id: String(identityId),
            identity_name: '',
            status: ok ? 'published' : 'failed',
            provider_post_id: provider.provider_post_id,
            live_url: provider.live_url,
            published_at: provider.published_at,
            media_asset_ids: [],
          },
          receipt: service.createActionReceipt({
            provider: providerPlatform === 'linkedin' ? 'linkedin' : 'facebook',
            providerReference: provider.provider_post_id,
            verified: Boolean(provider.verified),
            verifiedAt: provider.verified_at || (provider.verified ? provider.published_at : null),
            correlationId: actionId,
            liveUrl: provider.live_url,
          }),
          error: ok
            ? null
            : {
                code: provider.error_code || 'PUBLISH_FAILED',
                message: provider.error || 'Publish failed',
                retryable: provider.error_code === 'RATE_LIMITED',
              },
        };
      }

      if (!params.create) {
        return {
          ok: false,
          data: null,
          receipt: null,
          error: { code: 'VALIDATION_FAILED', message: 'create payload or existingPostId required' },
        };
      }

      return service.publish({
        ...params.create,
        tenantId: params.tenantId,
        userId: params.userId,
        idempotencyKey,
        correlationId: actionId,
        aiClient: params.create.aiClient || String(executionSource),
      });
    },
    isSuccess: (result) => Boolean(result.ok),
    mapError: (result) =>
      result.error
        ? {
            code: result.error.code || 'PUBLISH_FAILED',
            message: result.error.message || 'Publish failed',
            retryable: result.error.retryable,
          }
        : { code: 'PUBLISH_FAILED', message: 'Publish failed' },
    buildReceipt: (result) => {
      if (!result.receipt && !result.data) return null;
      const canonicalStatus =
        result.data?.status === 'published'
          ? 'succeeded'
          : result.data?.status === 'outcome_unknown'
          ? 'pending_verification'
          : result.data?.status || 'failed';
      return {
        action_id: result.receipt?.action_id || '',
        execution_id: result.receipt?.action_id || '',
        correlation_id: result.receipt?.action_id || '',
        status: canonicalStatus,
        operation: 'publish_social_post',
        resource_id: result.data?.social_post_id,
        timestamp: result.receipt?.verified_at || new Date().toISOString(),
        provider: result.receipt?.provider || platform,
        provider_reference: result.receipt?.provider_reference || result.data?.provider_post_id || undefined,
        live_url: result.receipt?.live_url || result.data?.live_url || undefined,
        entity_id: result.data?.social_post_id,
        entity_type: 'social_post',
        verification_status: canonicalStatus === 'succeeded' ? 'verified' : 'pending',
      };
    },
  });

  return domainResultFromGateway({
    executionSource: String(executionSource),
    gateway,
    businessObject: {
      type: 'social_post',
      id: gateway.result?.data?.social_post_id,
    },
    approvalState: guard.policy?.approvalState,
  });
}
