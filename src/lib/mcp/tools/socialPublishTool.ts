/**
 * Canonical MCP social publish handler — uses shared contract from socialPublishContract.ts.
 */

import { okResult, errorResult, toMcpContent } from '@/lib/mcp/connector/response';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';
import { SOCIAL_PUBLISH_TOOL_CATALOG_VERSION } from '@/lib/social/types';
import {
  type PublishSocialPostArgs,
  resolvePublishNow,
} from '@/lib/mcp/tools/socialPublishContract';

export {
  PUBLISH_EXECUTION_STATUS_VALUES,
  publishSocialPostInputSchema,
  publishSocialPostJsonSchema,
  publishSocialTargetSchema,
  resolvePublishNow,
  type PublishSocialPostArgs,
} from '@/lib/mcp/tools/socialPublishContract';

async function ingestInlineMedia(
  args: PublishSocialPostArgs,
  tenantId: string,
  userId: string
): Promise<{ assetIds: string[]; urls: string[] }> {
  const contentBase64 = args.content_base64 || args.file_base64 || args.file;
  const sourceUrl = args.source_url || args.url;
  const filename = args.filename || args.file_name;
  const mimeType = args.mime_type || args.content_type;
  const mediaAssetIds = [
    ...(args.media_ids || []),
    ...(args.media_asset_ids || []),
    ...(args.media_id ? [args.media_id] : []),
    ...(args.media_asset_id ? [args.media_asset_id] : []),
  ];
  const mediaUrls = [
    ...(args.media_urls || []),
    ...(args.media_url ? [args.media_url] : []),
    ...(args.image_url ? [args.image_url] : []),
    ...(args.signed_url ? [args.signed_url] : []),
  ];

  const hasRawMediaInput = Boolean(contentBase64 || args.data_url || sourceUrl);
  if (hasRawMediaInput) {
    const { rejectLocalAiPaths, ingestMediaInput } = await import('@/lib/media/ingestMedia');
    rejectLocalAiPaths(sourceUrl, 'source_url');
    rejectLocalAiPaths(contentBase64, 'content_base64');
    rejectLocalAiPaths(args.data_url, 'data_url');

    let mediaInput: Parameters<typeof ingestMediaInput>[0]['media'] | null = null;
    if (args.data_url || (contentBase64 && String(contentBase64).startsWith('data:'))) {
      mediaInput = {
        type: 'data_url' as const,
        dataUrl: args.data_url || String(contentBase64),
        filename,
      };
    } else if (sourceUrl) {
      mediaInput = { type: 'url' as const, url: sourceUrl, filename };
    } else if (contentBase64) {
      mediaInput = {
        type: 'base64' as const,
        data: contentBase64,
        filename: filename || 'upload.png',
        mimeType: mimeType || 'image/png',
      };
    }

    if (mediaInput) {
      const asset = await ingestMediaInput({
        tenantId,
        userId,
        purpose: 'social_post',
        media: mediaInput,
      });
      if (asset?.id) mediaAssetIds.push(asset.id);
      if (asset?.url) mediaUrls.push(asset.url);
    }
  }

  const { ingestPublishMedia } = await import('@/lib/media/ingestMedia');
  return ingestPublishMedia({
    tenantId,
    userId,
    media: args.media as Parameters<typeof ingestPublishMedia>[0]['media'],
    mediaUrls,
    mediaAssetIds,
  });
}

export async function handlePublishSocialPost(
  toolName: 'publish_social_post' | 'publish_post',
  args: PublishSocialPostArgs,
  ctx: { tenantId?: string; userId?: string }
) {
  const tenantId = ctx.tenantId || args.tenant_id;
  const userId = ctx.userId;
  if (!tenantId || !userId) {
    return toMcpContent(
      errorResult(toolName, 'AUTH_REQUIRED', 'Authenticated workspace session required')
    );
  }

  const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
  const { TenantIsolationError } = await import('@/lib/social/tenantGuard');

  const identityId =
    args.target?.identity_id ||
    args.identity_id ||
    args.page_id ||
    args.linkedin_organization_id ||
    undefined;
  const identityType = args.target?.identity_type || args.identity_type;
  const platformHint = args.target?.integration || args.platform;

  let stored;
  try {
    stored = await resolveTenantIdentityForPublish({
      tenantId,
      identityId,
      identityType,
      provider: platformHint,
      allowDefault: !identityId && !identityType,
    });
  } catch (err) {
    if (err instanceof TenantIsolationError) {
      return toMcpContent(errorResult(toolName, err.code, err.message, err.details));
    }
    throw err;
  }

  const platform = (stored.provider === 'linkedin' ? 'linkedin' : 'facebook') as
    | 'facebook'
    | 'linkedin';
  const resolvedIdentityType = stored.identity_type as
    | 'facebook_page'
    | 'linkedin_person'
    | 'linkedin_organization';

  const ingested = await ingestInlineMedia(args, tenantId, userId);
  const publishNow = resolvePublishNow(args);
  const caption = args.caption || args.content || '';

  if (args.dry_run) {
    const service = getSocialPublishingService();
    const preflight = await service.preflightPublish({
      tenantId,
      userId,
      platform,
      identityType: resolvedIdentityType,
      identityId: stored.provider_identity_id,
      caption,
      mediaAssetIds: ingested.assetIds,
      mediaUrls: ingested.urls,
      linkUrl: args.link_url,
      publishNow,
      scheduledAt: args.scheduled_at,
    });
    return toMcpContent(
      okResult(toolName, preflight, {
        meta: { dry_run: true, tool_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION },
      })
    );
  }

  const { executeMcpWrite } = await import('@/lib/mcp/executionGateway');

  const gatewayResult = await executeMcpWrite({
    tenantId,
    userId,
    tool: toolName,
    action: 'social.publish',
    mode: publishNow ? 'execute_now' : args.scheduled_at ? 'schedule' : 'draft',
    idempotencyKey: args.idempotency_key,
    target: {
      workspace_id: tenantId,
      integration: platform,
      identity_type: resolvedIdentityType,
      identity_id: stored.identity_id,
      resource_type: 'social_post',
    },
    payload: {
      platform,
      identityType: resolvedIdentityType,
      identityId: stored.provider_identity_id,
      caption,
      mediaAssetIds: ingested.assetIds,
      mediaUrls: ingested.urls,
      linkUrl: args.link_url,
      publishNow,
      scheduledAt: args.scheduled_at,
      aiClient: 'mcp',
    },
    execute: async ({ actionId }) => {
      const service = getSocialPublishingService();
      const { isDurableRuntimeEnabled } = await import('@/lib/bonnie/runtime/types');

      if (publishNow && isDurableRuntimeEnabled()) {
        const draft = await service.publish({
          tenantId,
          userId,
          platform,
          identityType: resolvedIdentityType,
          identityId: stored.provider_identity_id,
          caption,
          mediaAssetIds: ingested.assetIds,
          mediaUrls: ingested.urls,
          linkUrl: args.link_url,
          publishNow: false,
          scheduledAt: args.scheduled_at,
          idempotencyKey: args.idempotency_key,
          aiClient: 'mcp',
          correlationId: actionId,
        });
        if (!draft.ok || !draft.data?.social_post_id) {
          return draft;
        }

        try {
          const { enqueueSocialPublishTask } = await import('@/lib/social/socialPublishDurableTask');
          const enqueued = await enqueueSocialPublishTask({
            tenantId,
            userId,
            postId: draft.data.social_post_id,
            actionId,
            idempotencyKey: args.idempotency_key,
          });

          return {
            ok: true,
            data: {
              ...draft.data,
              status: 'queued',
              run_id: enqueued.runId,
              task_id: enqueued.taskId,
              durable: true,
              poll_tool: 'verify_social_post_published',
            },
            receipt: service.createActionReceipt({
              provider: platform,
              providerReference: null,
              verified: false,
              verifiedAt: null,
              correlationId: actionId,
            }),
            error: null,
          };
        } catch (durableErr) {
          console.warn('[socialPublishTool] Durable enqueue failed; falling back to direct publish:', durableErr);
          return service.publish({
            tenantId,
            userId,
            platform,
            identityType: resolvedIdentityType,
            identityId: stored.provider_identity_id,
            caption,
            mediaAssetIds: ingested.assetIds,
            mediaUrls: ingested.urls,
            linkUrl: args.link_url,
            publishNow: true,
            scheduledAt: args.scheduled_at,
            idempotencyKey: args.idempotency_key,
            aiClient: 'mcp',
            correlationId: actionId,
          });
        }
      }

      return service.publish({
        tenantId,
        userId,
        platform,
        identityType: resolvedIdentityType,
        identityId: stored.provider_identity_id,
        caption,
        mediaAssetIds: ingested.assetIds,
        mediaUrls: ingested.urls,
        linkUrl: args.link_url,
        publishNow,
        scheduledAt: args.scheduled_at,
        idempotencyKey: args.idempotency_key,
        aiClient: 'mcp',
        correlationId: actionId,
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
      if (!result.receipt) return null;
      return {
        action_id: result.receipt.action_id,
        status: result.data?.status || 'published',
        timestamp: result.receipt.verified_at || new Date().toISOString(),
        provider: result.receipt.provider,
        provider_reference: result.receipt.provider_reference,
        live_url: result.receipt.live_url,
        entity_id: result.data?.social_post_id,
        entity_type: 'social_post',
        verification: {
          verified: result.receipt.verified,
          verified_at: result.receipt.verified_at,
          correlation_id: result.receipt.correlation_id,
          target: {
            integration: platform,
            identity_type: resolvedIdentityType,
            identity_id: stored.identity_id,
          },
        },
      };
    },
  });

  if (!gatewayResult.ok) {
    return toMcpContent(
      errorResult(
        toolName,
        gatewayResult.error?.code || 'PUBLISH_FAILED',
        gatewayResult.error?.message || 'Publish failed',
        gatewayResult.error?.details,
        {
          retryable: gatewayResult.error?.retryable,
          meta: gatewayResult.error?.remediation
            ? { remediation: gatewayResult.error.remediation }
            : undefined,
        }
      )
    );
  }

  const result = gatewayResult.result;
  const receiptPayload = gatewayResult.receipt;

  return toMcpContent(
    okResult(
      toolName,
      {
        ...result?.data,
        media_asset_ids: ingested.assetIds,
        identity_id: stored.identity_id,
        identity_display_name: stored.display_name,
        action_id: gatewayResult.actionId,
        audit_log_id: gatewayResult.auditLogId,
      },
      {
        receipt: receiptPayload,
        meta: { tool_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION },
      }
    )
  );
}
