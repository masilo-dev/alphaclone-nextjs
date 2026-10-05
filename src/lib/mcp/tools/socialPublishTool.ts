/**
 * Canonical MCP social publish handler — uses shared contract from socialPublishContract.ts.
 */

import { okResult, errorResult, toMcpContent } from '@/lib/mcp/connector/response';
import { normalizePublishMediaArgs } from '@/lib/media/normalizePublishMedia';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';
import { SOCIAL_PUBLISH_TOOL_CATALOG_VERSION } from '@/lib/social/types';
import { logSocialPublishEvent } from '@/lib/social/socialPublishLog';
import {
  type PublishSocialPostArgs,
  destinationToIdentityType,
  resolvePublishNow,
} from '@/lib/mcp/tools/socialPublishContract';

export {
  PUBLISH_EXECUTION_STATUS_VALUES,
  SOCIAL_DESTINATION_VALUES,
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
  const normalized = normalizePublishMediaArgs(args as Record<string, unknown>);
  if (normalized.rejected.length) throw new Error(normalized.rejected[0]);

  const legacyFile = args.file;
  const legacyLooksLikePath = typeof legacyFile === 'string' && (
    legacyFile.startsWith('/') || legacyFile.startsWith('file:') ||
    legacyFile.startsWith('sandbox:') || /^[A-Za-z]:\\\\/.test(legacyFile)
  );
  const legacyLooksLikeOpenAiFile = typeof legacyFile === 'string' && /^file_[A-Za-z0-9]+$/.test(legacyFile);
  if (args.openai_file_id || args.local_file_path || legacyLooksLikePath || legacyLooksLikeOpenAiFile) {
    throw new Error(
      'CHATGPT_ATTACHMENT_UNRESOLVABLE: The MCP host supplied an attachment reference but did not expose authenticated bytes. ' +
      'The host must resolve openai_file_id/local_file_path and resend the actual bytes in content_base64; the reference will never be parsed as Base64.'
    );
  }
  const contentBase64 = args.content_base64 || args.file_base64 || legacyFile;
  const sourceUrl = args.source_url || args.url;
  const filename = args.filename || args.file_name;
  const mimeType = args.mime_type || args.content_type;
  const mediaAssetIds = [...normalized.mediaAssetIds];
  const mediaUrls = [...normalized.mediaUrls];

  const hasRawMediaInput = Boolean(contentBase64 || args.data_url || sourceUrl);
  if (hasRawMediaInput) {
    const { rejectLocalAiPaths, ingestMediaInput } = await import('@/lib/media/ingestMedia');
    rejectLocalAiPaths(sourceUrl, 'source_url');
    rejectLocalAiPaths(contentBase64, 'content_base64');
    rejectLocalAiPaths(args.data_url, 'data_url');

    let mediaInput: Parameters<typeof ingestMediaInput>[0]['media'] | null = null;
    if (args.data_url || (contentBase64 && String(contentBase64).startsWith('data:'))) {
      mediaInput = { type: 'data_url' as const, dataUrl: args.data_url || String(contentBase64), filename };
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
      const asset = await ingestMediaInput({ tenantId, userId, purpose: 'social_post', media: mediaInput });
      if (asset?.id && !mediaAssetIds.includes(asset.id)) mediaAssetIds.push(asset.id);
    }
  }

  const { ingestPublishMedia } = await import('@/lib/media/ingestMedia');
  return ingestPublishMedia({
    tenantId,
    userId,
    media: normalized.media.length ? normalized.media : (args.media as Parameters<typeof ingestPublishMedia>[0]['media']),
    mediaUrls,
    mediaAssetIds,
  });
}

export async function handlePublishSocialPost(
  toolName: 'publish_social_post' | 'publish_post',
  args: PublishSocialPostArgs,
  ctx: { tenantId?: string; userId?: string }
) {
  const startedAt = Date.now();
  const tenantId = ctx.tenantId || args.tenant_id;
  const userId = ctx.userId;
  if (!tenantId || !userId) {
    return toMcpContent(errorResult(toolName, 'AUTH_REQUIRED', 'Authenticated workspace session required'));
  }

  const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
  const { TenantIsolationError } = await import('@/lib/social/tenantGuard');

  const platformHint = args.target?.integration || args.platform;
  const requestedIdentityTypeHint = args.target?.identity_type || args.identity_type;
  const providerForIdentityType =
    requestedIdentityTypeHint?.startsWith('instagram_') ? 'instagram' :
    requestedIdentityTypeHint?.startsWith('linkedin_') ? 'linkedin' :
    requestedIdentityTypeHint === 'facebook_page' ? 'facebook' :
    undefined;
  if (platformHint && providerForIdentityType && platformHint !== providerForIdentityType) {
    return toMcpContent(
      errorResult(
        toolName,
        'SOCIAL_DESTINATION_MISMATCH',
        `platform=${platformHint} conflicts with identity_type=${requestedIdentityTypeHint}`
      )
    );
  }
  if (args.post_as === 'all_pages') {
    return toMcpContent(
      errorResult(
        toolName,
        'TARGET_AMBIGUOUS',
        'post_as=all_pages requires one explicit publish call per tenant-owned identity_id'
      )
    );
  }
  const postAsDestination =
    args.post_as === 'personal'
      ? 'personal'
      : args.post_as === 'company' || args.post_as === 'organization'
        ? 'organization'
        : undefined;
  const destination = args.target?.destination || args.destination || postAsDestination;
  const requestedIdentityType = args.target?.identity_type || args.identity_type;
  const destinationIdentityType = destinationToIdentityType(platformHint, destination);

  if (destination && !destinationIdentityType) {
    return toMcpContent(
      errorResult(
        toolName,
        'INVALID_DESTINATION',
        destination === 'personal'
          ? 'Personal publishing is currently a LinkedIn destination. Set platform=linkedin.'
          : destination === 'organization'
            ? 'Organization publishing is currently a LinkedIn destination. Set platform=linkedin.'
            : 'Page publishing is currently a Facebook destination. Set platform=facebook.'
      )
    );
  }

  if (requestedIdentityType && destinationIdentityType && requestedIdentityType !== destinationIdentityType) {
    return toMcpContent(
      errorResult(toolName, 'TARGET_CONFLICT', `destination=${destination} conflicts with identity_type=${requestedIdentityType}`)
    );
  }

  if (args.linkedin_organization_id && destinationIdentityType === 'linkedin_person') {
    return toMcpContent(
      errorResult(
        toolName,
        'LINKEDIN_DESTINATION_MISMATCH',
        'linkedin_organization_id cannot be used when the requested destination is personal'
      )
    );
  }

  const identityId =
    args.target?.identity_id || args.identity_id || args.page_id || args.linkedin_organization_id || undefined;
  const identityType = requestedIdentityType || destinationIdentityType;
  const correlationId = args.idempotency_key || crypto.randomUUID();

  logSocialPublishEvent({
    event: 'publish_requested',
    tool: toolName,
    tenant_id: tenantId,
    platform: platformHint,
    identity_id: identityId,
    identity_type: identityType,
    correlation_id: correlationId,
  });

  let stored;
  try {
    stored = await resolveTenantIdentityForPublish({
      tenantId,
      identityId,
      identityType,
      provider: platformHint,
      // A human-friendly destination is as explicit as identity_type. If the
      // selected type has exactly one identity, resolve it directly. Only use a
      // default when the user did not specify any destination at all.
      allowDefault: !identityId && !identityType,
    });
  } catch (err) {
    if (err instanceof TenantIsolationError) {
      logSocialPublishEvent({
        event: 'publish_identity_rejected',
        tool: toolName,
        tenant_id: tenantId,
        platform: platformHint,
        identity_id: identityId,
        identity_type: identityType,
        correlation_id: correlationId,
        error_code: err.code,
        duration_ms: Date.now() - startedAt,
      });
      return toMcpContent(errorResult(toolName, err.code, err.message, {
        ...(err.details || {}),
        selection_required: err.code === 'TARGET_AMBIGUOUS',
        requested_destination: destination || null,
      }));
    }
    throw err;
  }

  const platform = (
    stored.provider === 'linkedin' ? 'linkedin' :
    stored.provider === 'instagram' ? 'instagram' :
    'facebook'
  ) as 'facebook' | 'linkedin' | 'instagram';
  const resolvedIdentityType = stored.identity_type as
    | 'facebook_page'
    | 'linkedin_person'
    | 'linkedin_organization'
    | 'instagram_business'
    | 'instagram_creator';

  logSocialPublishEvent({
    event: 'publish_identity_resolved', tool: toolName, tenant_id: tenantId, platform,
    identity_id: stored.identity_id, identity_type: resolvedIdentityType,
    identity_name: stored.display_name, correlation_id: correlationId,
  });

  const ingested = await ingestInlineMedia(args, tenantId, userId);
  const publishNow = resolvePublishNow(args);
  const caption = args.caption || args.content || '';

  if (args.dry_run) {
    const service = getSocialPublishingService();
    const preflight = await service.preflightPublish({
      tenantId, userId, platform, identityType: resolvedIdentityType,
      identityId: stored.provider_identity_id, caption,
      mediaAssetIds: ingested.assetIds, mediaUrls: ingested.urls,
      linkUrl: args.link_url, publishNow, scheduledAt: args.scheduled_at,
    });
    return toMcpContent(okResult(toolName, preflight, { meta: { dry_run: true, tool_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION } }));
  }

  const { executeSocialPublishCommand } = await import('@/lib/execution/commands/socialPublishCommand');
  const gatewayResult = await executeSocialPublishCommand({
    tenantId,
    userId,
    executionSource: 'mcp',
    skipPolicyEvaluation: true, // registry guardToolExecution already evaluated policy
    idempotencyKey: args.idempotency_key,
    create: {
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
  });

  if (!gatewayResult.ok) {
    logSocialPublishEvent({
      event: 'publish_failed', tool: toolName, tenant_id: tenantId, platform,
      identity_id: stored.identity_id, identity_type: resolvedIdentityType,
      correlation_id: correlationId, error_code: gatewayResult.error?.code || gatewayResult.failure_code,
      duration_ms: Date.now() - startedAt,
    });
    return toMcpContent(errorResult(
      toolName,
      gatewayResult.error?.code || gatewayResult.failure_code || 'PUBLISH_FAILED',
      gatewayResult.error?.message || 'Publish failed',
      gatewayResult.error?.details,
      { retryable: gatewayResult.error?.retryable }
    ));
  }

  const result = gatewayResult.result;
  const receiptPayload = gatewayResult.receipt;
  logSocialPublishEvent({
    event: 'publish_succeeded', tool: toolName, tenant_id: tenantId, platform,
    identity_id: stored.identity_id, identity_type: resolvedIdentityType,
    identity_name: stored.display_name, social_post_id: result?.data?.social_post_id,
    correlation_id: correlationId, provider_status: result?.data?.status,
    duration_ms: Date.now() - startedAt,
  });

  return toMcpContent(okResult(toolName, {
    ...result?.data,
    platform,
    destination: destination || (resolvedIdentityType === 'linkedin_person' ? 'personal' : resolvedIdentityType === 'linkedin_organization' ? 'organization' : 'page'),
    identity_id: stored.identity_id,
    identity_type: resolvedIdentityType,
    identity_name: stored.display_name,
    provider_post_id: result?.data?.provider_post_id ?? receiptPayload?.provider_reference,
    live_url: result?.data?.live_url ?? receiptPayload?.live_url,
    published_at: result?.data?.published_at ?? receiptPayload?.timestamp,
    verification: receiptPayload?.verification ?? {
      verified: Boolean(receiptPayload?.status === 'verified' || receiptPayload?.status === 'published'),
      verified_at: receiptPayload?.timestamp ?? null,
      correlation_id: correlationId,
    },
    media_asset_ids: ingested.assetIds,
    action_id: gatewayResult.execution_id,
    audit_log_id: gatewayResult.receipt_id,
  }, {
    receipt: receiptPayload,
    meta: { tool_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION },
  }));
}
