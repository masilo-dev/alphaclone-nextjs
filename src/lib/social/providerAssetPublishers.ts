import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ingestMediaInput } from '@/lib/media/ingestMedia';

export type DirectPublishReceipt = {
  published: boolean;
  provider: 'instagram' | 'x';
  provider_post_id: string;
  live_url: string | null;
  verified: boolean;
  verification_timestamp: string;
  asset_ids: string[];
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
    throw new Error(payload?.error?.message || `Provider request failed (${response.status})`);
  }
  return payload as Record<string, any>;
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
  const { getInstagramIntegrationWithToken } = await import(
    '@/services/instagram/instagramIntegrationService'
  );
  const integration = await getInstagramIntegrationWithToken(admin, {
    tenantId: input.tenantId,
    instagramAccountId: input.instagramAccountId,
  });
  if (!integration) throw new Error('Instagram Business account is not connected or its token expired');

  const assets = await assetsForTenant(input.tenantId, input.userId, input.assetIds);
  const token = integration.pageAccessToken;
  const accountId = integration.instagram_account_id;
  let creationId: string;

  if (input.mode === 'carousel') {
    if (assets.length < 2 || assets.length > 10) {
      throw new Error('Instagram carousels require 2–10 assets');
    }
    const children: string[] = [];
    for (const asset of assets) {
      const isVideo = asset.mime_type.startsWith('video/');
      const child = await graphJson(`https://graph.facebook.com/v21.0/${accountId}/media`, {
        ...(isVideo ? { media_type: 'VIDEO', video_url: asset.url } : { image_url: asset.url }),
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
        ? { media_type: 'REELS', video_url: asset.url, share_to_feed: true }
        : { image_url: asset.url }),
      caption: input.caption,
      access_token: token,
    });
    creationId = String(container.id);
  }

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
  return {
    published: true,
    provider: 'instagram',
    provider_post_id: providerId,
    live_url: verified.permalink || null,
    verified: String(verified.id || '') === providerId,
    verification_timestamp: verifiedAt,
    asset_ids: input.assetIds,
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
