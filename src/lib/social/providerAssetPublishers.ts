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
  provider_post_id: string | null;
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
  return Promise.all(assetIds.map((assetId) => ingestMediaInput({ tenantId, userId, media: { type: 'asset_id', assetId } })));
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
  if (!response.ok || contentType !== expectedMime) throw new Error(`MEDIA_NOT_PROVIDER_ACCESSIBLE: provider URL returned HTTP ${response.status} ${contentType || 'without Content-Type'}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('MEDIA_NOT_PROVIDER_ACCESSIBLE: provider URL returned an empty body');
}

/**
 * Meta often returns a valid creation container before it has finished processing.
 * Poll briefly within the request budget; the durable reconciler continues longer
 * processing asynchronously. Never call media_publish until status is FINISHED.
 */
export async function waitForInstagramContainerReady(containerId: string, token: string, options: {
  timeoutMs?: number; pollIntervalMs?: number; signal?: AbortSignal;
} = {}) {
  const timeoutMs = Math.max(0, options.timeoutMs ?? 2_000);
  const pollIntervalMs = Math.max(100, options.pollIntervalMs ?? 1_000);
  if (timeoutMs === 0) {
    return graphJson(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
  }
  const deadline = Date.now() + timeoutMs;
  let latest: Record<string, any> = {};
  do {
    if (options.signal?.aborted) throw new Error('INSTAGRAM_PUBLISH_CANCELLED');
    latest = await graphJson(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
    const state = String(latest.status_code || '').toUpperCase();
    if (['FINISHED', 'ERROR', 'EXPIRED'].includes(state)) return latest;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return latest;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, Math.min(pollIntervalMs, remainingMs));
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error('INSTAGRAM_PUBLISH_CANCELLED'));
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
    });
  } while (Date.now() <= deadline);
  return latest;
}

export async function publishInstagramAssets(input: {
  tenantId: string; userId: string; assetIds: string[]; caption: string;
  mode: 'photo' | 'reel' | 'carousel'; instagramAccountId?: string;
  idempotencyKey?: string;
}): Promise<DirectPublishReceipt> {
  const admin = createSupabaseAdminClient();
  const claimed = await createPublishOperation({
    tenantId: input.tenantId, userId: input.userId, platform: 'instagram', identityType: 'instagram_business',
    identityId: input.instagramAccountId, assetIds: input.assetIds, caption: input.caption,
    idempotencyKey: input.idempotencyKey,
  });
  if (claimed.reused) return operationReceipt(claimed.operation) as DirectPublishReceipt;

  const identity = await resolveSocialIdentity({ tenantId: input.tenantId, provider: 'instagram', identityId: input.instagramAccountId, requiredCapability: 'publish' });
  const { getInstagramIntegrationWithToken } = await import('@/services/instagram/instagramIntegrationService');
  const integration = await getInstagramIntegrationWithToken(admin, { tenantId: input.tenantId, instagramAccountId: identity.provider_identity_id });
  if (!integration) throw new Error('INSTAGRAM_IDENTITY_NOT_FOUND: Instagram Business account is not connected or its token expired');

  const assets = await assetsForTenant(input.tenantId, input.userId, input.assetIds);
  const token = integration.pageAccessToken;
  const accountId = integration.instagram_account_id;
  let creationId: string;
  const providerUrls = assets.map((asset) => createProviderFetchUrl({ tenantId: input.tenantId, assetId: asset.id }));
  await Promise.all(assets.map((asset, index) => assertProviderFetchable(providerUrls[index], asset.mime_type)));

  if (input.mode === 'carousel') {
    if (assets.length < 2 || assets.length > 10) throw new Error('Instagram carousels require 2–10 assets');
    const children: string[] = [];
    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index];
      const child = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, {
        ...(asset.mime_type.startsWith('video/') ? { media_type: 'VIDEO', video_url: providerUrls[index] } : { image_url: providerUrls[index] }),
        is_carousel_item: true, access_token: token,
      });
      children.push(String(child.id));
    }
    const container = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, { media_type: 'CAROUSEL', children, caption: input.caption, access_token: token });
    creationId = String(container.id);
  } else {
    const asset = assets[0];
    if (input.mode === 'photo' && !asset.mime_type.startsWith('image/')) throw new Error('publish_instagram_photo requires an image asset');
    if (input.mode === 'reel' && !asset.mime_type.startsWith('video/')) throw new Error('publish_instagram_reel requires a video asset');
    const container = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, {
      ...(input.mode === 'reel' ? { media_type: 'REELS', video_url: providerUrls[0], share_to_feed: true } : { image_url: providerUrls[0] }),
      caption: input.caption, access_token: token,
    });
    creationId = String(container.id);
  }

  const { data: post, error: postError } = await admin.from('social_posts').insert({
    tenant_id: input.tenantId, user_id: input.userId, caption: input.caption, platforms: ['instagram'], provider: 'instagram',
    identity_id: identity.identity_id, identity_type: identity.identity_type, provider_identity_id: identity.provider_identity_id,
    media_urls: providerUrls, media_types: assets.map((asset) => asset.mime_type), status: 'queued',
    idempotency_key: claimed.operation.idempotency_key, correlation_id: claimed.operation.correlation_id, provider_container_id: creationId,
  }).select('id').single();
  if (postError) throw new Error(`INSTAGRAM_PUBLISH_FAILED: operation record could not be persisted: ${postError.message}`);
  const retryAfter = new Date(Date.now() + 5_000).toISOString();
  const { data: operation, error: operationError } = await admin.from('social_publish_operations').update({
    social_post_id: post.id, provider_container_id: creationId, state: 'provider_processing', retry_after: retryAfter, attempt_count: 1, updated_at: new Date().toISOString(),
  }).eq('id', claimed.operation.id).eq('tenant_id', input.tenantId).select('*').single();
  if (operationError) throw new Error(operationError.message);
  const { error: linkPostError } = await admin.from('social_posts').update({ publish_operation_id: operation.id })
    .eq('tenant_id', input.tenantId).eq('id', post.id);
  if (linkPostError) throw new Error(`INSTAGRAM_PUBLISH_FAILED: operation could not be linked to its post: ${linkPostError.message}`);
  // Meta may finish photo containers before its initial creation request returns.
  // Publish synchronously when ready so a normal photo post does not wait for cron.
  try {
    const ready = await waitForInstagramContainerReady(creationId, token, { timeoutMs: 2_000, pollIntervalMs: 500 });
    if (ready.status_code === 'FINISHED') {
      const published = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
        creation_id: creationId, access_token: token,
      });
      const providerId = String(published.id || '');
      if (!providerId) throw new Error('INSTAGRAM_MISSING_MEDIA_ID');
      const verified = await graphJson(`https://graph.facebook.com/v21.0/${providerId}?fields=id,permalink,timestamp,username&access_token=${encodeURIComponent(token)}`);
      if (String(verified.id || '') !== providerId) throw new Error('INSTAGRAM_VERIFICATION_FAILED');
      const verifiedAt = new Date().toISOString();
      const { error: postUpdateError } = await admin.from('social_posts').update({
        status: 'published', instagram_post_id: providerId, provider_permalink: verified.permalink || null,
        live_url: verified.permalink || null, published_at: verified.timestamp || verifiedAt,
        verification_timestamp: verifiedAt, retry_safe: false,
      }).eq('tenant_id', input.tenantId).eq('id', post.id);
      if (postUpdateError) throw new Error(postUpdateError.message);
      const { data: completed, error: completeError } = await admin.from('social_publish_operations').update({
        state: 'published', provider_post_id: providerId, provider_permalink: verified.permalink || null,
        provider_identity_verified: true, verification_timestamp: verifiedAt,
        published_at: verified.timestamp || verifiedAt, retry_safe: false,
        last_provider_response: { id: verified.id, permalink: verified.permalink, timestamp: verified.timestamp },
        locked_by: null, locked_until: null, retry_after: null, updated_at: verifiedAt,
      }).eq('id', operation.id).eq('tenant_id', input.tenantId).select('*').single();
      if (completeError) throw new Error(completeError.message);
      return operationReceipt(completed) as DirectPublishReceipt;
    }
    if (ready.status_code === 'ERROR' || ready.status_code === 'EXPIRED') {
      const { data: failed, error: failedError } = await admin.from('social_publish_operations').update({
        state: 'failed_terminal', retry_safe: true, failure_code: 'INSTAGRAM_CONTAINER_FAILED',
        failure_message: String(ready.status || ready.status_code), last_provider_response: ready,
        retry_after: null, updated_at: new Date().toISOString(),
      }).eq('id', operation.id).eq('tenant_id', input.tenantId).select('*').single();
      if (failedError) throw new Error(failedError.message);
      const { error: postFailureError } = await admin.from('social_posts').update({ status: 'failed', retry_safe: true, structured_failure_code: 'INSTAGRAM_CONTAINER_FAILED', error_message: String(ready.status || ready.status_code) })
        .eq('tenant_id', input.tenantId).eq('id', post.id);
      if (postFailureError) throw new Error(postFailureError.message);
      return operationReceipt(failed) as DirectPublishReceipt;
    }
  } catch (error) {
    // The durable reconciler remains responsible for transient Meta/API errors.
    if (error instanceof Error && error.message.includes('INSTAGRAM_CONTAINER_FAILED')) throw error;
  }
  return operationReceipt(operation) as DirectPublishReceipt;
}

const INSTAGRAM_RECONCILABLE_STATES = ['provider_processing', 'failed_retryable', 'reconciliation_required', 'verifying'];

async function persistInstagramPublished(admin: ReturnType<typeof createSupabaseAdminClient>, operation: any, providerId: string, token: string) {
  const verified = await graphJson(`https://graph.facebook.com/v21.0/${providerId}?fields=id,permalink,timestamp,username&access_token=${encodeURIComponent(token)}`);
  if (String(verified.id || '') !== providerId) throw new Error('INSTAGRAM_VERIFICATION_FAILED');
  const verifiedAt = new Date().toISOString();
  const { error: postUpdateError } = await admin.from('social_posts').update({
    status: 'published', instagram_post_id: providerId, provider_permalink: verified.permalink || null,
    live_url: verified.permalink || null, published_at: verified.timestamp || verifiedAt,
    verification_timestamp: verifiedAt, retry_safe: false,
  }).eq('tenant_id', operation.tenant_id).eq('id', operation.social_post_id);
  if (postUpdateError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${postUpdateError.message}`);
  const { data: completed, error: completeError } = await admin.from('social_publish_operations').update({
    state: 'published', provider_post_id: providerId, provider_permalink: verified.permalink || null,
    provider_identity_verified: true, verification_timestamp: verifiedAt,
    published_at: verified.timestamp || verifiedAt, retry_safe: false,
    last_provider_response: { id: verified.id, permalink: verified.permalink, timestamp: verified.timestamp },
    locked_by: null, locked_until: null, retry_after: null, updated_at: verifiedAt,
  }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
  if (completeError) throw new Error(completeError.message);
  return completed;
}

export async function reconcileInstagramPublishOperation(operationId: string) {
  const admin = createSupabaseAdminClient();
  const workerId = `instagram-reconcile:${process.pid}`;
  const now = new Date();
  const { data: operation, error } = await admin.from('social_publish_operations').update({
    locked_by: workerId, locked_until: new Date(now.getTime() + 60_000).toISOString(), reconciliation_timestamp: now.toISOString(), state: 'verifying',
  }).eq('id', operationId).in('state', INSTAGRAM_RECONCILABLE_STATES)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`).select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!operation) return null;

  const integration = await (await import('@/services/instagram/instagramIntegrationService')).getInstagramIntegrationWithToken(admin, {
    tenantId: operation.tenant_id, instagramAccountId: operation.provider_identity_id,
  });
  if (!integration) throw new Error('INSTAGRAM_IDENTITY_NOT_FOUND');
  const token = integration.pageAccessToken;
  const container = await waitForInstagramContainerReady(operation.provider_container_id, token, { timeoutMs: 5_000, pollIntervalMs: 1_000 });
  if (!['FINISHED', 'ERROR', 'EXPIRED'].includes(String(container.status_code))) {
    const attempts = Number(operation.attempt_count || 0) + 1;
    const next = new Date(Date.now() + Math.min(300, 5 * (2 ** Math.min(attempts, 6))) * 1000).toISOString();
    const { data } = await admin.from('social_publish_operations').update({
      state: 'provider_processing', attempt_count: attempts, retry_after: next,
      locked_by: null, locked_until: null, retry_safe: false, last_provider_response: container, updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    return operationReceipt(data);
  }
  if (container.status_code === 'ERROR' || container.status_code === 'EXPIRED') {
    const { data, error: terminalError } = await admin.from('social_publish_operations').update({
      state: 'failed_terminal', retry_safe: true, failure_code: 'INSTAGRAM_CONTAINER_FAILED', failure_message: String(container.status || container.status_code),
      last_provider_response: container, locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    if (terminalError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${terminalError.message}`);
    const { error: postFailureError } = await admin.from('social_posts').update({
      status: 'failed', retry_safe: true, structured_failure_code: 'INSTAGRAM_CONTAINER_FAILED',
      error_message: String(container.status || container.status_code),
    }).eq('tenant_id', operation.tenant_id).eq('id', operation.social_post_id);
    if (postFailureError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${postFailureError.message}`);
    return operationReceipt(data);
  }
  if (container.status_code !== 'FINISHED') {
    const { data, error: statusError } = await admin.from('social_publish_operations').update({
      state: 'failed_retryable', retry_safe: false, failure_code: 'INSTAGRAM_CONTAINER_STATUS_UNKNOWN',
      failure_message: String(container.status || container.status_code || 'Instagram returned no container status'),
      last_provider_response: container, retry_after: new Date(Date.now() + 30_000).toISOString(),
      locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    if (statusError) throw new Error(statusError.message);
    return operationReceipt(data);
  }
  const socialPost = operation.social_post_id
    ? (await admin.from('social_posts').select('instagram_post_id').eq('tenant_id', operation.tenant_id).eq('id', operation.social_post_id).maybeSingle()).data
    : null;
  const alreadyPublishedId = operation.provider_post_id || socialPost?.instagram_post_id;
  if (alreadyPublishedId) {
    return operationReceipt(await persistInstagramPublished(admin, operation, String(alreadyPublishedId), token));
  }
  // Only a media_publish request with an unknown outcome is unsafe to replay.
  // A previously unknown *container status* is different: once that same persisted
  // container reaches FINISHED, no publish request has been issued yet, so it is
  // safe (and required) to continue to media_publish below.
  if (operation.failure_code === 'INSTAGRAM_PUBLISH_OUTCOME_UNKNOWN') {
    const next = new Date(Date.now() + 60_000).toISOString();
    const { data, error: pendingError } = await admin.from('social_publish_operations').update({
      state: 'reconciliation_required', retry_safe: false, retry_after: next,
      locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    if (pendingError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${pendingError.message}`);
    return operationReceipt(data);
  }
  try {
    const published = await graphJson(`https://graph.facebook.com/v21.0/${integration.instagram_account_id}/media_publish`, { creation_id: operation.provider_container_id, access_token: token });
    const providerId = String(published.id || '');
    if (!providerId) throw new Error('INSTAGRAM_MISSING_MEDIA_ID');
    return operationReceipt(await persistInstagramPublished(admin, operation, providerId, token));
  } catch (publishError) {
    // A timeout can happen after Meta accepted media_publish. Query the same
    // container by its unique ID before any later attempt; never issue a second
    // publish call while the first outcome is ambiguous.
    const retryAfter = new Date(Date.now() + 30_000).toISOString();
    const { data: pending, error: pendingError } = await admin.from('social_publish_operations').update({
      state: 'failed_retryable', retry_safe: false, failure_code: 'INSTAGRAM_PUBLISH_OUTCOME_UNKNOWN',
      failure_message: publishError instanceof Error ? publishError.message : String(publishError),
      retry_after: retryAfter, locked_by: null, locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq('id', operation.id).eq('tenant_id', operation.tenant_id).select('*').single();
    if (pendingError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${pendingError.message}`);
    return operationReceipt(pending);
  }
}

export async function reconcileDueInstagramOperations(limit = 25) {
  const admin = createSupabaseAdminClient();
  // Legacy direct publish flows could persist a queued post and its provider
  // container but fail before attaching the operation. Recover those rows so the
  // existing container is reconciled; never create another Instagram container.
  const { data: orphanedPosts, error: orphanError } = await admin.from('social_posts')
    .select('id, tenant_id, user_id, caption, identity_id, identity_type, provider_identity_id, provider_container_id, idempotency_key, correlation_id, media_urls')
    .eq('provider', 'instagram').eq('status', 'queued').not('provider_container_id', 'is', null)
    .is('instagram_post_id', null).is('publish_operation_id', null).limit(limit);
  if (orphanError) throw new Error(orphanError.message);
  for (const post of orphanedPosts || []) {
    const { data: existing, error: existingError } = await admin.from('social_publish_operations').select('id, social_post_id')
      .eq('tenant_id', post.tenant_id).eq('platform', 'instagram').eq('provider_container_id', post.provider_container_id).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const { error: linkPostError } = await admin.from('social_posts').update({ publish_operation_id: existing.id })
        .eq('tenant_id', post.tenant_id).eq('id', post.id);
      if (linkPostError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${linkPostError.message}`);
      if (!existing.social_post_id) {
        const { error: linkOperationError } = await admin.from('social_publish_operations').update({ social_post_id: post.id })
          .eq('id', existing.id).eq('tenant_id', post.tenant_id);
        if (linkOperationError) throw new Error(`INSTAGRAM_RECONCILIATION_PERSIST_FAILED: ${linkOperationError.message}`);
      }
      continue;
    }
    const { data: identity } = await admin.from('social_identities').select('identity_type')
      .eq('tenant_id', post.tenant_id).eq('id', post.identity_id).eq('provider', 'instagram').maybeSingle();
    if (!identity) continue;
    // A missing legacy ledger row must remain manually recoverable: reconstructing
    // its idempotency/checksum from URLs is unsafe. Existing ledger rows are linked
    // above; no new provider write is ever made here.
  }
  const { data, error } = await admin.from('social_publish_operations').select('id')
    .eq('platform', 'instagram').in('state', INSTAGRAM_RECONCILABLE_STATES)
    .or(`retry_after.is.null,retry_after.lte.${new Date().toISOString()}`)
    .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`).limit(limit);
  if (error) throw new Error(error.message);
  const results = [];
  for (const row of data || []) {
    try {
      results.push(await reconcileInstagramPublishOperation(row.id));
    } catch (error) {
      const retryAfter = new Date(Date.now() + 30_000).toISOString();
      const failureMessage = error instanceof Error ? error.message : String(error);
      const { data: failed } = await admin.from('social_publish_operations').update({
        state: 'failed_retryable', retry_safe: false, failure_code: 'INSTAGRAM_RECONCILIATION_FAILED', failure_message: failureMessage,
        retry_after: retryAfter, locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
      }).eq('id', row.id).select('*').single();
      results.push(failed ? operationReceipt(failed) : { operation_id: row.id, state: 'failed_retryable', retry_after: retryAfter });
    }
  }
  return results;
}

export async function publishXAssets(input: { tenantId: string; userId: string; assetIds: string[]; content: string; }): Promise<DirectPublishReceipt> {
  const assets = await assetsForTenant(input.tenantId, input.userId, input.assetIds);
  if (assets.length > 4) throw new Error('X supports at most four image assets per post');
  const { xService } = await import('@/services/xService');
  const mediaIds: string[] = [];
  for (const asset of assets) mediaIds.push(await xService.uploadMediaFromUrl(input.tenantId, asset.url));
  const result = await xService.postTweet(input.tenantId, { text: input.content, media_ids: mediaIds });
  const providerId = String(result?.data?.id || '');
  if (!providerId) throw new Error('X returned no post ID');
  const verified = await xService.getTweet(input.tenantId, providerId);
  const verifiedAt = new Date().toISOString();
  return { published: true, provider: 'x', provider_post_id: providerId, live_url: `https://x.com/i/web/status/${providerId}`,
    verified: String(verified?.data?.id || '') === providerId, verification_timestamp: verifiedAt, asset_ids: input.assetIds };
}
