import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ingestMediaInput } from '@/lib/media/ingestMedia';
import { createProviderFetchUrl } from '@/lib/media/providerFetchUrl';
import { resolveSocialIdentity } from '@/lib/social/socialIdentityStore';
import {
  formatFacebookGraphErrorMessage,
  parseFacebookGraphError,
  sanitizeFacebookPayload,
} from '@/lib/facebook/parseFacebookGraphError';

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

  await waitForInstagramContainerReady(creationId, token);

  const published = await graphJson(
    `https://graph.facebook.com/v21.0/${accountId}/media_publish`,
    { creation_id: creationId, access_token: token }
  );
  const providerId = String(published.id || '');
  if (!providerId) throw new Error('Instagram returned no published media ID');

  const verified = await graphJson(
    `https://graph.facebook.com/v21.0/${providerId}?fields=id,permalink,timestamp&access_token=${encodeURIComponent(token)}`
  );
  const verifiedAt = new Date().toISOString();
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
    status: 'published',
    instagram_post_id: providerId,
    published_at: verifiedAt,
  }).select('id').single();
  if (postError) throw new Error(`INSTAGRAM_PUBLISH_FAILED: published media ID could not be persisted: ${postError.message}`);
  return {
    published: true,
    provider: 'instagram',
    provider_post_id: providerId,
    live_url: verified.permalink || null,
    verified: String(verified.id || '') === providerId,
    verification_timestamp: verifiedAt,
    asset_ids: input.assetIds,
    identity_id: identity.identity_id,
    social_post_id: post.id,
  };
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
