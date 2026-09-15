import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ingestMediaInput } from '@/lib/media/ingestMedia';
import { createProviderFetchUrl } from '@/lib/media/providerFetchUrl';
import { resolveSocialIdentity } from '@/lib/social/socialIdentityStore';
import {
  formatFacebookGraphErrorMessage,
  parseFacebookGraphError,
  sanitizeFacebookPayload,
} from '@/lib/facebook/parseFacebookGraphError';
import { createPublishOperation, operationReceipt } from '@/lib/social/publishOperationService';

export type DirectPublishReceipt = {
  published: boolean;
  provider: 'instagram' | 'x';
  provider_post_id: string;
  live_url: string | null;
  verified: boolean;
  verification_timestamp: string;
  asset_ids: string[];
  identity_id?: string;
  social_post_id?: string;
  operation_id?: string;
  correlation_id?: string;
  state?: string;
  retry_safe?: boolean;
  retry_after?: string | null;
  provider_container_id?: string | null;
};

async function assetsForTenant(tenantId: string, userId: string, assetIds: string[]) {
  if (!assetIds.length) throw new Error('At least one asset_id is required');
  return Promise.all(
    assetIds.map((assetId) =>
      ingestMediaInput({
        tenantId,
        userId,
        media: { type: 'asset_id', assetId },
      })
    )
  );
}

async function graphJson(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const parsed = parseFacebookGraphError(response.status, payload);
    const err = new Error(formatFacebookGraphErrorMessage(parsed));
    (err as Error & { diagnostics?: unknown; provider_response?: unknown }).diagnostics = parsed;
    (err as Error & { provider_response?: unknown }).provider_response = sanitizeFacebookPayload(payload);
    throw err;
  }
  return payload as Record<string, any>;
}

async function assertProviderFetchable(url: string, expectedMime: string): Promise<void> {
  const response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { Accept: expectedMime } });
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!response.ok || contentType !== expectedMime) {
    throw new Error(`INSTAGRAM_MEDIA_FETCH_FAILED: provider URL returned HTTP ${response.status} ${contentType || 'without Content-Type'}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('INSTAGRAM_MEDIA_FETCH_FAILED: provider URL returned an empty body');
}

async function waitForInstagramContainerReady(containerId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await graphJson(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`INSTAGRAM_CONTAINER_FAILED: ${String(status.status || status.status_code)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_500));
  }
  throw new Error('INSTAGRAM_CONTAINER_FAILED: container did not become ready before timeout');
}

export async function publishInstagramAssets(input: {
  tenantId: string;
  userId: string;
  assetIds: string[];
  caption: string;
  mode: 'photo' | 'reel' | 'carousel';
  instagramAccountId?: string;
}): Promise<DirectPublishReceipt> {
  const admin = createSupabaseAdminClient();
  const requestedType = 'instagram_business' as const;
  const claimed = await createPublishOperation({
    tenantId: input.tenantId, userId: input.userId, platform: 'instagram',
    identityType: requestedType, identityId: input.instagramAccountId,
    assetIds: input.assetIds, caption: input.caption,
  });
  if (claimed.reused) return operationReceipt(claimed.operation) as DirectPublishReceipt;

  const identity = await resolveSocialIdentity({
    tenantId: input.tenantId,
    provider: 'instagram',
    identityId: input.instagramAccountId,
    requiredCapability: 'publish',
  });
  const { getInstagramIntegrationWithToken } = await import(
    '@/services/instagram/instagramIntegrationService'
  );
  const integration = await getInstagramIntegrationWithToken(admin, {
    tenantId: input.tenantId,
    instagramAccountId: identity.provider_identity_id,
  });
  if (!integration) throw new Error('INSTAGRAM_IDENTITY_NOT_FOUND: Instagram Business account is not connected or its token expired');

  const assets = await assetsForTenant(input.tenantId, input.userId, input.assetIds);
  const token = integration.pageAccessToken;
  const accountId = integration.instagram_account_id;
  let creationId: string;
  const providerUrls = assets.map((asset) => createProviderFetchUrl({ tenantId: input.tenantId, assetId: asset.id }));
  await Promise.all(assets.map((asset, index) => assertProviderFetchable(providerUrls[index], asset.mime_type)));

  if (input.mode === 'carousel') {
    if (assets.length < 2 || assets.length > 10) {
      throw new Error('Instagram carousels require 2–10 assets');
    }
    const children: string[] = [];
    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index];
      const isVideo = asset.mime_type.startsWith('video/');
      const child = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, {
        ...(isVideo ? { media_type: 'VIDEO', video_url: providerUrls[index] } : { image_url: providerUrls[index] }),
        is_carousel_item: true,
        access_token: token,
      });
      children.push(String(child.id));
    }
    const container = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, {
      media_type: 'CAROUSEL',
      children,
      caption: input.caption,
      access_token: token,
    });
    creationId = String(container.id);
  } else {
    const asset = assets[0];
    if (input.mode === 'photo' && !asset.mime_type.startsWith('image/')) {
      throw new Error('publish_instagram_photo requires an image asset');
    }
    if (input.mode === 'reel' && !asset.mime_type.startsWith('video/')) {
      throw new Error('publish_instagram_reel requires a video asset');
    }
    const container = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, {
      ...(input.mode === 'reel'
        ? { media_type: 'REELS', video_url: providerUrls[0], share_to_feed: true }
        : { image_url: providerUrls[0] }),
      caption: input.caption,
      access_token: token,
    });
    creationId = String(container.id);
  }

  const { data: post, error: postError } = await admin.from('social_posts').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    caption: input.caption,
    platforms: ['instagram'],
    provider: 'instagram',
    identity_id: identity.identity_id,
    identity_type: identity.identity_type,
    provider_identity_id: identity.provider_identity_id,
    media_urls: providerUrls,
    media_types: assets.map((asset) => asset.mime_type),
    status: 'queued',
    idempotency_key: claimed.operation.idempotency_key,
    correlation_id: claimed.operation.correlation_id,
    provider_container_id: creationId,
  }).select('id').single();
  if (postError) throw new Error(`INSTAGRAM_PUBLISH_FAILED: operation record could not be persisted: ${postError.message}`);
  const retryAfter = new Date(Date.now() + 15_000).toISOString();
  const { data: operation, error: operationError } = await admin.from('social_publish_operations').update({
    social_post_id: post.id, provider_container_id: creationId,
    state: 'provider_processing', retry_after: retryAfter, attempt_count: 1,
    updated_at: new Date().toISOString(),
  }).eq('id', claimed.operation.id).eq('tenant_id', input.tenantId).select('*').single();
  if (operationError) throw new Error(operationError.message);
  return operationReceipt(operation) as DirectPublishReceipt;
}

export async function reconcileInstagramPublishOperation(operationId: string) {
  const admin = createSupabaseAdminClient();
  const workerId = `instagram-reconcile:${process.pid}`;
  const now = new Date();
  const { data: operation, error } = await admin.from('social_publish_operations').update({
    locked_by: workerId, locked_until: new Date(now.getTime() + 60_000).toISOString(),
    reconciliation_timestamp: now.toISOString(), state: 'verifying',
  }).eq('id', operationId).in('state', ['provider_processing','reconciliation_required','failed_retryable'])
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`).select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!operation) return null;

  const integration = await (await import('@/services/instagram/instagramIntegrationService'))
    .getInstagramIntegrationWithToken(admin, {
      tenantId: operation.tenant_id, instagramAccountId: operation.provider_identity_id,
    });
  if (!integration) throw new Error('INSTAGRAM_IDENTITY_NOT_FOUND');
  const token = integration.pageAccessToken;
  const container = await graphJson(`https://graph.facebook.com/v21.0/${operation.provider_container_id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
  if (!['FINISHED','ERROR','EXPIRED'].includes(String(container.status_code))) {
    const attempts = Number(operation.attempt_count || 0) + 1;
    const terminal = attempts >= 12;
    const next = new Date(Date.now() + Math.min(300, 5 * (2 ** Math.min(attempts, 6))) * 1000).toISOString();
    const { data } = await admin.from('social_publish_operations').update({
      state: terminal ? 'reconciliation_required' : 'provider_processing', attempt_count: attempts,
      retry_after: next, locked_by: null, locked_until: null, retry_safe: false,
      last_provider_response: container, updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    return operationReceipt(data);
  }
  if (container.status_code !== 'FINISHED') {
    const { data } = await admin.from('social_publish_operations').update({
      state: 'failed_terminal', retry_safe: true, failure_code: 'INSTAGRAM_CONTAINER_FAILED',
      failure_message: String(container.status || container.status_code), last_provider_response: container,
      locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    return operationReceipt(data);
  }
  const published = await graphJson(`https://graph.facebook.com/v21.0/${integration.instagram_account_id}/media_publish`, {
    creation_id: operation.provider_container_id, access_token: token,
  });
  const providerId = String(published.id || '');
  if (!providerId) throw new Error('INSTAGRAM_MISSING_MEDIA_ID');
  const verified = await graphJson(`https://graph.facebook.com/v21.0/${providerId}?fields=id,permalink,timestamp,username&access_token=${encodeURIComponent(token)}`);
  if (String(verified.id || '') !== providerId) throw new Error('INSTAGRAM_VERIFICATION_FAILED');
  const verifiedAt = new Date().toISOString();
  await admin.from('social_posts').update({
    status: 'published', instagram_post_id: providerId, provider_permalink: verified.permalink || null,
    live_url: verified.permalink || null, published_at: verified.timestamp || verifiedAt,
    verification_timestamp: verifiedAt, retry_safe: false,
  }).eq('tenant_id', operation.tenant_id).eq('id', operation.social_post_id);
  const { data: completed, error: completeError } = await admin.from('social_publish_operations').update({
    state: 'published', provider_post_id: providerId, provider_permalink: verified.permalink || null,
    provider_identity_verified: true, verification_timestamp: verifiedAt,
    published_at: verified.timestamp || verifiedAt, retry_safe: false,
    last_provider_response: { id: verified.id, permalink: verified.permalink, timestamp: verified.timestamp },
    locked_by: null, locked_until: null, retry_after: null, updated_at: verifiedAt,
  }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
  if (completeError) throw new Error(completeError.message);
  return operationReceipt(completed);
}

export async function reconcileDueInstagramOperations(limit = 25) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('social_publish_operations').select('id')
    .eq('platform', 'instagram').in('state', ['provider_processing','failed_retryable'])
    .or(`retry_after.is.null,retry_after.lte.${new Date().toISOString()}`).limit(limit);
  if (error) throw new Error(error.message);
  const results = [];
  for (const row of data || []) results.push(await reconcileInstagramPublishOperation(row.id));
  return results;
}

export async function publishXAssets(input: {
  tenantId: string;
  userId: string;
  assetIds: string[];
  content: string;
}): Promise<DirectPublishReceipt> {
  const assets = await assetsForTenant(input.tenantId, input.userId, input.assetIds);
  if (assets.length > 4) throw new Error('X supports at most four image assets per post');
  const { xService } = await import('@/services/xService');
  const mediaIds: string[] = [];
  for (const asset of assets) {
    mediaIds.push(await xService.uploadMediaFromUrl(input.tenantId, asset.url));
  }
  const result = await xService.postTweet(input.tenantId, {
    text: input.content,
    media_ids: mediaIds,
  });
  const providerId = String(result?.data?.id || '');
  if (!providerId) throw new Error('X returned no post ID');
  const verified = await xService.getTweet(input.tenantId, providerId);
  const verifiedAt = new Date().toISOString();
  return {
    published: true,
    provider: 'x',
    provider_post_id: providerId,
    live_url: `https://x.com/i/web/status/${providerId}`,
    verified: String(verified?.data?.id || '') === providerId,
    verification_timestamp: verifiedAt,
    asset_ids: input.assetIds,
  };
}
