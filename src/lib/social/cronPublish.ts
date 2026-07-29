import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';
import { publishLinkedInPost } from '@/lib/linkedin/publishPost';
import { getZernioClient, getTenantZernioSettings } from '@/lib/zernio/client';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';

=======
import {
  enqueueSocialPostSync,
  findRecentDuplicateLinkedInCaption,
  parseLinkedInUgcPostUrn,
  updateSocialPostLinkedInUrnWithRetry,
} from '@/lib/social/linkedinPublishHelpers';
>>>>>>> origin/main

type PublishResult = {
  ok: boolean;
  platform: 'facebook' | 'linkedin';
  reason?: string;
};

<<<<<<< HEAD
=======
function extractCompanyPagesFromMetadata(raw: unknown): Array<{ id: string; name: string | null }> {
  if (!raw || typeof raw !== 'object') return [];
  const maybePages = (raw as { company_pages?: unknown }).company_pages;
  if (!Array.isArray(maybePages)) return [];
  return maybePages
    .map((page) => {
      if (!page || typeof page !== 'object') return null;
      const obj = page as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : '';
      if (!id) return null;
      return {
        id,
        name: typeof obj.name === 'string' ? obj.name : null,
      };
    })
    .filter((page): page is { id: string; name: string | null } => !!page);
}

>>>>>>> origin/main
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

<<<<<<< HEAD
=======
function normalizeScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

>>>>>>> origin/main
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

<<<<<<< HEAD
    const integration = await getFacebookIntegrationWithToken(adminClient, {
      tenantId: post.tenant_id,
      pageId: post.facebook_page_id,
    });

    if (!integration?.pageAccessToken) {
=======
    const { data: integration, error: intError } = await adminClient
      .from('facebook_integrations')
      .select('page_access_token')
      .eq('tenant_id', post.tenant_id)
      .eq('page_id', post.facebook_page_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (intError || !integration?.page_access_token) {
>>>>>>> origin/main
      return { ok: false, platform: 'facebook', reason: 'integration_missing' };
    }

    const mediaUrl = Array.isArray(post.media_urls) ? post.media_urls[0] : undefined;
    const mediaType = Array.isArray(post.media_types) ? String(post.media_types[0] || '').toLowerCase() : '';
    const isVideo = mediaType === 'video' || (typeof mediaUrl === 'string' && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(mediaUrl));
    const fbBody: Record<string, string> = {
      message: post.caption,
<<<<<<< HEAD
      access_token: integration.pageAccessToken,
=======
      access_token: integration.page_access_token,
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
  const adminClient = createSupabaseAdminClient();

  try {
    const postRes = await adminClient
      .from('social_posts')
      .select('id, tenant_id, user_id, caption, link_url, media_urls, linkedin_member_id, linkedin_organization_id, metadata')
      .eq('id', postId)
      .single();
    let post = postRes.data as {
      id: string;
      tenant_id: string;
      user_id: string;
      caption: string;
      link_url: string | null;
      media_urls: string[] | null;
      linkedin_member_id: string | null;
      linkedin_organization_id: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    let postError = postRes.error;
    if (isMissingColumn(postError, 'linkedin_member_id') || isMissingColumn(postError, 'linkedin_organization_id')) {
      const fallbackPostRes = await adminClient
        .from('social_posts')
        .select('id, tenant_id, user_id, caption, link_url, media_urls, metadata')
        .eq('id', postId)
        .single();
      post = fallbackPostRes.data
        ? { ...fallbackPostRes.data, linkedin_member_id: null, linkedin_organization_id: null }
        : null;
      postError = fallbackPostRes.error;
    }

    if (postError || !post) return { ok: false, platform: 'linkedin', reason: 'post_not_found' };

    let liQuery = adminClient
      .from('linkedin_integrations')
      .select('linkedin_member_id, linkedin_person_urn, access_token, scopes, metadata')
      .eq('tenant_id', post.tenant_id)
      .eq('user_id', post.user_id)
      .eq('is_active', true)
      .limit(1);
    if (post.linkedin_member_id) {
      liQuery = liQuery.eq('linkedin_member_id', post.linkedin_member_id);
    }
    const liRes = await liQuery.maybeSingle();
    let li = liRes.data;
    let liError = liRes.error;
    if (isMissingColumn(liError, 'linkedin_member_id')) {
      const fallbackLiRes = await adminClient
        .from('linkedin_integrations')
        .select('linkedin_person_urn, access_token, scopes, metadata')
        .eq('tenant_id', post.tenant_id)
        .eq('user_id', post.user_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      li = fallbackLiRes.data ? { ...fallbackLiRes.data, linkedin_member_id: null } : null;
      liError = fallbackLiRes.error;
    }

    const integration = li?.access_token ? li : await (async () => {
      const fallbackRes = await adminClient
        .from('linkedin_integrations')
        .select('linkedin_member_id, linkedin_person_urn, access_token, scopes, metadata')
        .eq('tenant_id', post.tenant_id)
        .eq('user_id', post.user_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (isMissingColumn(fallbackRes.error, 'linkedin_member_id')) {
        const fallbackWithoutMember = await adminClient
          .from('linkedin_integrations')
          .select('linkedin_person_urn, access_token, scopes, metadata')
          .eq('tenant_id', post.tenant_id)
          .eq('user_id', post.user_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        return fallbackWithoutMember.data
          ? { ...fallbackWithoutMember.data, linkedin_member_id: null }
          : null;
      }
      return fallbackRes.data;
    })();

    if (liError || !integration?.access_token || !integration?.linkedin_person_urn) {
      return { ok: false, platform: 'linkedin', reason: 'LinkedIn account is not connected' };
    }
    const activeIntegration = integration;

    const scopes = normalizeScopes(activeIntegration.scopes);
    if (!scopes.includes('w_member_social')) {
      return { ok: false, platform: 'linkedin', reason: 'LinkedIn is missing w_member_social scope' };
    }

    const requestedOrganizationId =
      typeof post.linkedin_organization_id === 'string' && post.linkedin_organization_id
        ? post.linkedin_organization_id
        : typeof post.metadata?.linkedin_organization_id === 'string'
          ? String(post.metadata.linkedin_organization_id)
          : null;
    const companyPages = extractCompanyPagesFromMetadata((activeIntegration as any)?.metadata);
    const selectedCompany = requestedOrganizationId
      ? companyPages.find((page) => String(page.id) === requestedOrganizationId)
      : null;
    const canPostAsCompany = !!selectedCompany && scopes.includes('w_organization_social');
    const authorUrn = canPostAsCompany
      ? `urn:li:organization:${requestedOrganizationId}`
      : activeIntegration.linkedin_person_urn;

    async function registerAndUploadLinkedInMedia(author: string, mediaUrl: string, isVideo: boolean): Promise<string> {
      const mediaFetch = await fetchWithTimeout(mediaUrl, { method: 'GET' }, isVideo ? 60000 : 25000);
      if (!mediaFetch.ok) {
        throw new Error(`Could not download media URL (${mediaFetch.status})`);
      }
      const contentType = mediaFetch.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');
      const mediaBuffer = await mediaFetch.arrayBuffer();

      const registerRes = await fetchWithTimeout('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeIntegration.access_token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: [isVideo ? 'urn:li:digitalmediaRecipe:feedshare-video' : 'urn:li:digitalmediaRecipe:feedshare-image'],
            owner: author,
            serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
          },
        }),
      }, 25000);

      const registerJson = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok) {
        throw new Error(registerJson?.message || `LinkedIn upload register failed (${registerRes.status})`);
      }

      const value = registerJson?.value || {};
      const assetUrn = typeof value?.asset === 'string' ? value.asset : '';
      const uploadUrl =
        value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl || '';

      if (!assetUrn || !uploadUrl) {
        throw new Error('LinkedIn upload response missing asset information');
      }

      const uploadRes = await fetchWithTimeout(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: mediaBuffer,
      }, isVideo ? 60000 : 30000);

      if (!uploadRes.ok) {
        throw new Error(`LinkedIn media upload failed (${uploadRes.status})`);
      }

      return assetUrn;
    }

    const hasLink = typeof post.link_url === 'string' && post.link_url.trim().length > 0;
    const mediaUrls = Array.isArray(post.media_urls) ? post.media_urls.filter((url) => typeof url === 'string' && url.trim()) : [];
    const hasMedia = mediaUrls.length > 0;

    let shareMediaCategory: 'NONE' | 'ARTICLE' | 'IMAGE' | 'VIDEO' = 'NONE';
    let media: Array<Record<string, unknown>> = [];

    if (hasMedia) {
      const firstMediaUrl = mediaUrls[0];
      const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(firstMediaUrl);

      if (isVideo) {
        const assetUrn = await registerAndUploadLinkedInMedia(authorUrn, firstMediaUrl, true);
        shareMediaCategory = 'VIDEO';
        media = [{
          status: 'READY',
          media: assetUrn,
          title: { text: 'AlphaClone Video' },
        }];
      } else {
        shareMediaCategory = 'IMAGE';
        for (let i = 0; i < mediaUrls.length; i++) {
          const imageUrl = mediaUrls[i];
          const assetUrn = await registerAndUploadLinkedInMedia(authorUrn, imageUrl, false);
          media.push({
            status: 'READY',
            media: assetUrn,
            title: { text: `AlphaClone Image ${i + 1}` },
          });
        }
      }
    } else if (hasLink) {
      shareMediaCategory = 'ARTICLE';
      media = [{ status: 'READY', originalUrl: post.link_url, title: { text: 'AlphaClone Link' } }];
    }

    const dup = await findRecentDuplicateLinkedInCaption(
      adminClient,
      post.tenant_id,
      post.user_id,
      post.caption,
      7
    );
    if (dup) {
      return {
        ok: false,
        platform: 'linkedin',
        reason: 'Duplicate post detected in the last 7 days.',
      };
    }

    const payload = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.caption },
          shareMediaCategory,
          media,
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const res = await fetchWithTimeout('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeIntegration.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    }, 25000);

    const rawBody = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        platform: 'linkedin',
        reason: rawBody || `LinkedIn publish failed with status ${res.status}`,
      };
    }

    const postUrn = parseLinkedInUgcPostUrn(res, rawBody);
    const patch: Record<string, unknown> = {
      linkedin_post_urn: postUrn,
      linkedin_member_id: activeIntegration.linkedin_member_id || post.linkedin_member_id || null,
      linkedin_organization_id: canPostAsCompany ? requestedOrganizationId : null,
    };

    const retry = await updateSocialPostLinkedInUrnWithRetry(adminClient, postId, patch);
    if (!retry.ok) {
      const fallbackPatch = { linkedin_post_urn: postUrn };
      const retry2 = await updateSocialPostLinkedInUrnWithRetry(adminClient, postId, fallbackPatch);
      if (!retry2.ok && postUrn) {
        await enqueueSocialPostSync(adminClient, {
          socialPostId: postId,
          tenantId: post.tenant_id,
          platform: 'linkedin',
          externalId: postUrn,
          lastError: retry.error || retry2.error,
        });
      }
    }

    return { ok: true, platform: 'linkedin' };
  } catch (err) {
    console.error('[cron/social-publish] LinkedIn publish error:', err);
    return { ok: false, platform: 'linkedin', reason: 'LinkedIn publish failed' };
>>>>>>> origin/main
  }
}

export async function publishSocialPost(postId: string) {
  const adminClient = createSupabaseAdminClient();
<<<<<<< HEAD
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
=======
  const { data: post } = await adminClient
    .from('social_posts')
    .select('id, platforms')
>>>>>>> origin/main
    .eq('id', postId)
    .single();

  if (!post) return;

  const platforms = Array.isArray(post.platforms) ? post.platforms : [];
  const jobs: Promise<PublishResult>[] = [];

<<<<<<< HEAD
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
=======
  if (platforms.includes('facebook')) jobs.push(publishToFacebook(postId));
  if (platforms.includes('linkedin')) jobs.push(publishToLinkedIn(postId));
>>>>>>> origin/main

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

<<<<<<< HEAD
=======
  await updateSocialPostStatusWithFallback(postId, {
    status: 'publishing',
    error_message: null,
  });
>>>>>>> origin/main
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

<<<<<<< HEAD

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

=======
export async function publishDueSocialPosts(limit = 25) {
>>>>>>> origin/main
  const adminClient = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await adminClient
    .from('social_posts')
    .select('id')
    .eq('status', 'scheduled')
<<<<<<< HEAD
    .contains('platforms', ['linkedin'])
    .is('linkedin_post_urn', null)
=======
>>>>>>> origin/main
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
<<<<<<< HEAD

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
=======
>>>>>>> origin/main
