import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';
import { publishLinkedInPost } from '@/lib/linkedin/publishPost';
import { getZernioClient, getTenantZernioSettings } from '@/lib/zernio/client';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';


type PublishResult = {
  ok: boolean;
  platform: 'facebook' | 'linkedin';
  reason?: string;
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isMissingColumn(error: unknown, columnName: string) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === '42703' && (maybeError.message || '').includes(columnName);
}

function isStatusConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === '23514' &&
    (maybeError.message || '').includes('social_posts_status_check')
  );
}

function mapStatusForLegacyConstraint(status: string): string {
  if (status === 'queued' || status === 'publishing') return 'scheduled';
  return status;
}

async function updateSocialPostStatusWithFallback(
  postId: string,
  payload: Record<string, unknown>
) {
  const adminClient = createSupabaseAdminClient();
  const firstTry = await adminClient
    .from('social_posts')
    .update(payload)
    .eq('id', postId);
  if (!isStatusConstraintViolation(firstTry.error)) return firstTry;

  const fallbackPayload = { ...payload };
  if (typeof fallbackPayload.status === 'string') {
    fallbackPayload.status = mapStatusForLegacyConstraint(fallbackPayload.status);
  }
  return await adminClient
    .from('social_posts')
    .update(fallbackPayload)
    .eq('id', postId);
}

async function publishToFacebook(postId: string): Promise<PublishResult> {
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: post, error: postError } = await adminClient
      .from('social_posts')
      .select('id, tenant_id, facebook_page_id, caption, link_url, media_urls, media_types')
      .eq('id', postId)
      .single();

    if (postError || !post) return { ok: false, platform: 'facebook', reason: 'post_not_found' };
    if (!post.facebook_page_id) {
      return { ok: false, platform: 'facebook', reason: 'missing_page_id' };
    }

    const integration = await getFacebookIntegrationWithToken(adminClient, {
      tenantId: post.tenant_id,
      pageId: post.facebook_page_id,
    });

    if (!integration?.pageAccessToken) {
      return { ok: false, platform: 'facebook', reason: 'integration_missing' };
    }

    const mediaUrl = Array.isArray(post.media_urls) ? post.media_urls[0] : undefined;
    const mediaType = Array.isArray(post.media_types) ? String(post.media_types[0] || '').toLowerCase() : '';
    const isVideo = mediaType === 'video' || (typeof mediaUrl === 'string' && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(mediaUrl));
    const fbBody: Record<string, string> = {
      message: post.caption,
      access_token: integration.pageAccessToken,
    };

    if (post.link_url) fbBody.link = post.link_url;
    if (mediaUrl) {
      if (isVideo) {
        fbBody.file_url = String(mediaUrl);
        fbBody.description = post.caption;
      } else {
        fbBody.url = String(mediaUrl);
      }
    }

    const endpoint = mediaUrl
      ? `https://graph.facebook.com/v19.0/${post.facebook_page_id}/${isVideo ? 'videos' : 'photos'}`
      : `https://graph.facebook.com/v19.0/${post.facebook_page_id}/feed`;

    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fbBody),
    });

    const result = await res.json();

    if (!res.ok || result?.error) {
      return {
        ok: false,
        platform: 'facebook',
        reason: result?.error?.message || 'Facebook publish failed',
      };
    }

    await adminClient.from('social_posts').update({
      facebook_post_id: result.id || result.post_id || null,
    }).eq('id', postId);
    return { ok: true, platform: 'facebook' };
  } catch (err) {
    console.error('[cron/social-publish] Facebook publish error:', err);
    return { ok: false, platform: 'facebook', reason: 'Publish job failed' };
  }
}

async function publishToLinkedIn(postId: string): Promise<PublishResult> {
  const result = await publishLinkedInPost(postId);
  return { ok: result.ok, platform: 'linkedin', reason: result.reason };
}

async function publishToZernio(
  postId: string,
  platform: 'instagram' | 'linkedin'
): Promise<PublishResult> {
  const adminClient = createSupabaseAdminClient();
  try {
    const postRes = await adminClient
      .from('social_posts')
      .select('id, tenant_id, caption, media_urls, media_types, link_url')
      .eq('id', postId)
      .single();

    if (postRes.error || !postRes.data) {
      return { ok: false, platform: platform as any, reason: 'post_not_found' };
    }

    const post = postRes.data;
    const zernioSettings = await getTenantZernioSettings(post.tenant_id);
    if (!zernioSettings) {
      return { ok: false, platform: platform as any, reason: 'Zernio integration not configured for this tenant' };
    }

    let accountId: string | undefined;
    if (platform === 'instagram') {
      accountId = zernioSettings.instagramAccountId || zernioSettings.accountId;
    } else if (platform === 'linkedin') {
      accountId = zernioSettings.linkedinOrgAccountId || zernioSettings.accountId;
    }

    if (!accountId) {
      return { ok: false, platform: platform as any, reason: `No Zernio account ID configured for platform: ${platform}` };
    }

    const zernio = getZernioClient();

    // Map media items
    const rawUrls: unknown = post.media_urls;
    const mediaUrls: string[] = Array.isArray(rawUrls)
      ? rawUrls.filter((url: unknown): url is string => typeof url === 'string' && !!url.trim())
      : [];
    const rawTypes: unknown = post.media_types;
    const mediaTypes: string[] = Array.isArray(rawTypes)
      ? rawTypes.map((t: unknown) => String(t || ''))
      : [];
    const mediaItems = mediaUrls.map((url: string, idx: number) => {
      const typeStr = String(mediaTypes[idx] || '').toLowerCase();
      const isVideo = typeStr === 'video' || /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
      return {
        type: (isVideo ? 'video' : 'image') as 'video' | 'image',
        url,
      };
    });

    let content = post.caption || '';
    if (platform === 'linkedin' && post.link_url) {
      content += `\n\n${post.link_url}`;
    }

    const response = await zernio.posts.createPost({
      body: {
        content,
        mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
        platforms: [{ platform, accountId }],
        publishNow: true,
      },
    });

    const resultId = (response as any).data?.id || (response as any).data?.postId || null;

    if (platform === 'instagram') {
      await adminClient.from('social_posts').update({
        instagram_post_id: resultId,
      }).eq('id', postId);
    } else if (platform === 'linkedin') {
      await adminClient.from('social_posts').update({
        linkedin_post_urn: resultId ? `urn:li:ugcPost:${resultId}` : null,
      }).eq('id', postId);
    }

    return { ok: true, platform: platform as any };
  } catch (err: any) {
    console.error(`[cron/social-publish] Zernio ${platform} publish error:`, err);
    return { ok: false, platform: platform as any, reason: err?.message || `Zernio publish failed` };
  }
}

export async function publishSocialPost(postId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data: currentPost } = await adminClient
    .from('social_posts')
    .select('id, status, linkedin_post_urn')
    .eq('id', postId)
    .maybeSingle();

  if (!currentPost) return;
  if (currentPost.status === 'published') return;
  if (currentPost.linkedin_post_urn) return;

  if (currentPost.status === 'publishing') {
    const { data: full } = await adminClient
      .from('social_posts')
      .select('updated_at')
      .eq('id', postId)
      .maybeSingle();
    const updatedAt = full?.updated_at ? new Date(full.updated_at).getTime() : 0;
    const stuckMs = Date.now() - updatedAt;
    if (stuckMs < 15 * 60 * 1000) return;
    await updateSocialPostStatusWithFallback(postId, {
      status: 'scheduled',
      error_message: 'Reclaimed from stuck publishing state',
    });
  }

  const claimResult = await updateSocialPostStatusWithFallback(postId, {
    status: 'publishing',
    error_message: null,
  });
  if (claimResult.error) return;

  const { data: post } = await adminClient
    .from('social_posts')
    .select('id, tenant_id, platforms, linkedin_organization_id, metadata')
    .eq('id', postId)
    .single();

  if (!post) return;

  const platforms = Array.isArray(post.platforms) ? post.platforms : [];
  const jobs: Promise<PublishResult>[] = [];

  // Fetch Zernio settings to determine LinkedIn Org page routing
  const zernioSettings = await getTenantZernioSettings(post.tenant_id);

  if (platforms.includes('facebook')) jobs.push(publishToFacebook(postId));
  if (platforms.includes('linkedin')) {
    const requestedOrganizationId =
      typeof post.linkedin_organization_id === 'string' && post.linkedin_organization_id
        ? post.linkedin_organization_id
        : typeof post.metadata?.linkedin_organization_id === 'string'
          ? String(post.metadata.linkedin_organization_id)
          : null;

    if (requestedOrganizationId && zernioSettings?.linkedinOrgAccountId) {
      // Post to LinkedIn Org via Zernio
      jobs.push(publishToZernio(postId, 'linkedin'));
    } else {
      // Post natively
      jobs.push(publishToLinkedIn(postId));
    }
  }
  if (platforms.includes('instagram')) {
    jobs.push(publishToZernio(postId, 'instagram'));
  }

  if (jobs.length === 0) {
    if (platforms.includes('platform')) {
      await adminClient.from('social_posts').update({
        status: 'published',
        published_at: new Date().toISOString(),
        error_message: null,
      }).eq('id', postId);
      return;
    }
    await adminClient.from('social_posts').update({
      status: 'failed',
      error_message: 'No supported social platform selected',
    }).eq('id', postId);
    return;
  }

  const results = await Promise.all(jobs);
  const failed = results.filter((r) => !r.ok);
  const succeeded = results.filter((r) => r.ok);

  if (failed.length > 0 && succeeded.length === 0) {
    const message = failed.map((r) => `${r.platform}: ${r.reason || 'failed'}`).join(' | ');
    await updateSocialPostStatusWithFallback(postId, {
      status: 'failed',
      error_message: message,
    });
    return;
  }

  if (failed.length > 0 && succeeded.length > 0) {
    const partialMessage = `Partial publish: ${failed
      .map((r) => `${r.platform}: ${r.reason || 'failed'}`)
      .join(' | ')}`;
    await updateSocialPostStatusWithFallback(postId, {
      status: 'published',
      published_at: new Date().toISOString(),
      error_message: partialMessage,
    });
    return;
  }

  await updateSocialPostStatusWithFallback(postId, {
    status: 'published',
    published_at: new Date().toISOString(),
    error_message: null,
  });
}


export async function publishDueSocialPosts(limit = 25) {
  if (!isSocialPublishEnabled()) return 0;
  const { getSocialPublishingService } = await import('@/lib/social/SocialPublishingService');
  const result = await getSocialPublishingService().processDueScheduledPosts(limit);
  return result.processed;
}

/**
 * Publish due LinkedIn posts specifically (for the LinkedIn cron).
 * Queries social_posts where status='scheduled', platform contains 'linkedin',
 * scheduled_at <= NOW(), and linkedin_post_urn IS NULL.
 */
export async function publishDueLinkedInPosts(limit = 25) {
  if (!isSocialPublishEnabled()) return 0;

  const adminClient = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await adminClient
    .from('social_posts')
    .select('id')
    .eq('status', 'scheduled')
    .contains('platforms', ['linkedin'])
    .is('linkedin_post_urn', null)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const duePosts = data || [];
  for (const post of duePosts) {
    await publishSocialPost(post.id);
  }

  return duePosts.length;
}

export async function publishScheduledPosts(limit = 25) {
  if (!isSocialPublishEnabled()) return 0;

  const adminClient = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Query scheduled_posts table for due posts (status='pending' and scheduled_at <= now())
  const { data: duePosts, error } = await adminClient
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[publishScheduledPosts] failed to query scheduled posts:', error);
    throw error;
  }

  if (!duePosts || duePosts.length === 0) {
    return 0;
  }

  console.log(`[publishScheduledPosts] Found ${duePosts.length} due scheduled posts`);

  for (const post of duePosts) {
    try {
      if (!post.tenant_id) {
        console.error(`[publishScheduledPosts] scheduled post ${post.id} missing tenant_id — skipping`);
        await adminClient.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id);
        continue;
      }

      // Get media asset if asset_id is present — MUST be tenant-scoped
      let mediaUrls: string[] = [];
      let mediaTypes: string[] = [];
      if (post.asset_id) {
        const { data: asset } = await adminClient
          .from('media_assets')
          .select('public_url, asset_type, tenant_id')
          .eq('id', post.asset_id)
          .eq('tenant_id', post.tenant_id)
          .maybeSingle();
        if (asset) {
          mediaUrls = [asset.public_url];
          mediaTypes = [asset.asset_type];
        } else {
          console.error(
            `[publishScheduledPosts] media_asset ${post.asset_id} not found for tenant ${post.tenant_id}`
          );
        }
      }

      // Resolve Facebook page from THIS tenant's connections — never hard-code a page ID
      let fbPageId: string | null = null;
      let linkedinOrgId: string | null = null;
      let identityId: string | null = null;
      let identityType: string | null = null;

      if (post.platform === 'facebook') {
        const { resolveTenantIdentityForPublish } = await import(
          '@/lib/social/socialIdentityStore'
        );
        try {
          const identity = await resolveTenantIdentityForPublish({
            tenantId: post.tenant_id,
            identityId: post.identity_id || post.facebook_page_id || null,
            identityType: 'facebook_page',
            provider: 'facebook',
            allowDefault: true,
          });
          fbPageId = identity.provider_identity_id;
          identityId = identity.identity_id;
          identityType = identity.identity_type;
        } catch (err: any) {
          console.error(
            `[publishScheduledPosts] No Facebook identity for tenant ${post.tenant_id}:`,
            err?.message || err
          );
          await adminClient.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id);
          continue;
        }
      } else if (post.platform === 'linkedin') {
        const { resolveTenantIdentityForPublish } = await import(
          '@/lib/social/socialIdentityStore'
        );
        try {
          const identity = await resolveTenantIdentityForPublish({
            tenantId: post.tenant_id,
            identityId: post.identity_id || post.linkedin_organization_id || null,
            identityType: post.identity_type || undefined,
            provider: 'linkedin',
            allowDefault: true,
          });
          identityId = identity.identity_id;
          identityType = identity.identity_type;
          if (identity.identity_type === 'linkedin_organization') {
            linkedinOrgId = identity.provider_identity_id;
          }
        } catch (err: any) {
          console.error(
            `[publishScheduledPosts] No LinkedIn identity for tenant ${post.tenant_id}:`,
            err?.message || err
          );
          await adminClient.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id);
          continue;
        }
      }

      // Insert into social_posts to leverage the existing publishSocialPost function
      const { data: socialPost, error: insertError } = await adminClient
        .from('social_posts')
        .insert({
          tenant_id: post.tenant_id,
          user_id: post.user_id,
          caption: post.content || '',
          platforms: [post.platform],
          platform: post.platform,
          media_urls: mediaUrls,
          media_types: mediaTypes,
          status: 'scheduled',
          scheduled_at: nowIso,
          facebook_page_id: fbPageId,
          linkedin_organization_id: linkedinOrgId,
          identity_id: identityId,
          identity_type: identityType,
          provider: post.platform,
          provider_identity_id: fbPageId || linkedinOrgId,
          metadata: {
            identity_id: identityId,
            identity_type: identityType,
            linkedin_organization_id: linkedinOrgId,
            source: 'scheduled_posts',
          },
        })
        .select()
        .single();

      if (insertError || !socialPost) {
        console.error(`[publishScheduledPosts] Failed to insert social post for scheduled post ${post.id}:`, insertError);
        await adminClient
          .from('scheduled_posts')
          .update({
            status: 'failed',
          })
          .eq('id', post.id);
        continue;
      }

      // Publish the social post using the existing publishing function
      await publishSocialPost(socialPost.id);

      // Check the final status of the social post
      const { data: updatedSocialPost } = await adminClient
        .from('social_posts')
        .select('status, error_message')
        .eq('id', socialPost.id)
        .single();

      if (updatedSocialPost?.status === 'published') {
        await adminClient
          .from('scheduled_posts')
          .update({
            status: 'sent',
            published_at: nowIso,
          })
          .eq('id', post.id);
      } else {
        await adminClient
          .from('scheduled_posts')
          .update({
            status: 'failed',
          })
          .eq('id', post.id);
      }
    } catch (err: any) {
      console.error(`[publishScheduledPosts] Error publishing post ${post.id}:`, err);
      await adminClient
        .from('scheduled_posts')
        .update({
          status: 'failed',
        })
        .eq('id', post.id);
    }
  }

  return duePosts.length;
}
