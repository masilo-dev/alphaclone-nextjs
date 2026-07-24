import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { linkedInFetch, LinkedInApiError } from '@/lib/linkedin/linkedinClient';
import {
  enqueueSocialPostSync,
  findRecentDuplicateLinkedInCaption,
  parseLinkedInUgcPostUrn,
  updateSocialPostLinkedInUrnWithRetry,
} from '@/lib/social/linkedinPublishHelpers';
import {
  getLinkedInIntegrationWithToken,
  markLinkedInIntegrationInactive,
  normalizeLinkedInScopes,
  resolveLinkedInCompanyPagesForTenant,
} from '@/services/linkedin/linkedinIntegrationService';

export type LinkedInPublishResult = {
  ok: boolean;
  platform: 'linkedin';
  reason?: string;
  postUrn?: string | null;
};

type SocialPostRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  caption: string;
  link_url: string | null;
  media_urls: string[] | null;
  linkedin_member_id: string | null;
  linkedin_organization_id: string | null;
  metadata?: Record<string, unknown> | null;
};

function isMissingColumn(error: unknown, columnName: string) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === '42703' && (maybeError.message || '').includes(columnName);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function registerAndUploadLinkedInMedia(
  accessToken: string,
  author: string,
  mediaUrl: string,
  isVideo: boolean
): Promise<string> {
  const mediaFetch = await fetchWithTimeout(mediaUrl, { method: 'GET' }, isVideo ? 60000 : 25000);
  if (!mediaFetch.ok) {
    throw new Error(`Could not download media URL (${mediaFetch.status})`);
  }
  const contentType = mediaFetch.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');
  const mediaBuffer = await mediaFetch.arrayBuffer();

  const registerRes = await linkedInFetch(
    'https://api.linkedin.com/v2/assets?action=registerUpload',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: [
            isVideo ? 'urn:li:digitalmediaRecipe:feedshare-video' : 'urn:li:digitalmediaRecipe:feedshare-image',
          ],
          owner: author,
          serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
        },
      }),
    },
    { timeoutMs: 25000 }
  );

  const registerJson = await registerRes.json().catch(() => ({}));
  const value = registerJson?.value || {};
  const assetUrn = typeof value?.asset === 'string' ? value.asset : '';
  const uploadUrl =
    value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl || '';

  if (!assetUrn || !uploadUrl) {
    throw new Error('LinkedIn upload response missing asset information');
  }

  const uploadRes = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: mediaBuffer,
    },
    isVideo ? 60000 : 30000
  );

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn media upload failed (${uploadRes.status})`);
  }

  return assetUrn;
}

async function loadSocialPost(admin: SupabaseClient, postId: string): Promise<SocialPostRow | null> {
  const postRes = await admin
    .from('social_posts')
    .select('id, tenant_id, user_id, caption, link_url, media_urls, linkedin_member_id, linkedin_organization_id, metadata')
    .eq('id', postId)
    .single();

  if (!postRes.error && postRes.data) return postRes.data as SocialPostRow;

  if (
    isMissingColumn(postRes.error, 'linkedin_member_id') ||
    isMissingColumn(postRes.error, 'linkedin_organization_id')
  ) {
    const fallback = await admin
      .from('social_posts')
      .select('id, tenant_id, user_id, caption, link_url, media_urls, metadata')
      .eq('id', postId)
      .single();
    if (fallback.data) {
      return { ...fallback.data, linkedin_member_id: null, linkedin_organization_id: null } as SocialPostRow;
    }
  }
  return null;
}

export async function publishLinkedInPost(postId: string): Promise<LinkedInPublishResult> {
  const admin = createSupabaseAdminClient();

  try {
    const post = await loadSocialPost(admin, postId);
    if (!post) return { ok: false, platform: 'linkedin', reason: 'post_not_found' };

    const integration = await getLinkedInIntegrationWithToken(admin, {
      tenantId: post.tenant_id,
      userId: post.user_id,
      linkedinMemberId: post.linkedin_member_id,
    });

    if (!integration?.accessToken || !integration.linkedin_person_urn) {
      return { ok: false, platform: 'linkedin', reason: 'LinkedIn account is not connected' };
    }

    const scopes = normalizeLinkedInScopes(integration.scopes);
    const requestedOrganizationId =
      typeof post.linkedin_organization_id === 'string' && post.linkedin_organization_id
        ? post.linkedin_organization_id
        : typeof post.metadata?.linkedin_organization_id === 'string'
          ? String(post.metadata.linkedin_organization_id)
          : null;
    const companyPages = await resolveLinkedInCompanyPagesForTenant(admin, post.tenant_id, integration.metadata);
    const selectedCompany = requestedOrganizationId
      ? companyPages.find((page) => String(page.id) === requestedOrganizationId)
      : null;

    if (requestedOrganizationId) {
      if (!scopes.includes('w_organization_social')) {
        return { ok: false, platform: 'linkedin', reason: 'LinkedIn is missing w_organization_social scope' };
      }
      // Never post to a random org or fall back to personal when org was requested
      if (!selectedCompany) {
        // Allow if metadata explicitly requested this org id for this tenant post,
        // but refuse personal fallback. Still require the org id to be numeric.
        if (!/^\d+$/.test(requestedOrganizationId)) {
          return {
            ok: false,
            platform: 'linkedin',
            reason: `LinkedIn organization ${requestedOrganizationId} is not available for this tenant`,
          };
        }
        console.warn(
          `[publishLinkedInPost] org ${requestedOrganizationId} not in cached company pages; publishing as org URN only (no personal fallback)`
        );
      }
    } else {
      // If post metadata insists on organization, never fall back to personal
      const metaType = post.metadata?.identity_type;
      if (metaType === 'linkedin_organization') {
        return {
          ok: false,
          platform: 'linkedin',
          reason:
            'linkedin_organization was requested but linkedin_organization_id is missing — refusing personal fallback',
        };
      }
      if (!scopes.includes('w_member_social')) {
        return { ok: false, platform: 'linkedin', reason: 'LinkedIn is missing w_member_social scope' };
      }
    }

    const canPostAsCompany = Boolean(requestedOrganizationId && scopes.includes('w_organization_social'));
    if (requestedOrganizationId && !canPostAsCompany) {
      return {
        ok: false,
        platform: 'linkedin',
        reason: 'Cannot publish as organization without w_organization_social',
      };
    }
    const authorUrn = canPostAsCompany
      ? `urn:li:organization:${requestedOrganizationId}`
      : integration.linkedin_person_urn;

    const hasLink = typeof post.link_url === 'string' && post.link_url.trim().length > 0;
    const mediaUrls = Array.isArray(post.media_urls)
      ? post.media_urls.filter((url) => typeof url === 'string' && url.trim())
      : [];
    const hasMedia = mediaUrls.length > 0;

    let shareMediaCategory: 'NONE' | 'ARTICLE' | 'IMAGE' | 'VIDEO' = 'NONE';
    let media: Array<Record<string, unknown>> = [];

    if (hasMedia) {
      const firstMediaUrl = mediaUrls[0];
      const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(firstMediaUrl);
      if (isVideo) {
        const assetUrn = await registerAndUploadLinkedInMedia(
          integration.accessToken,
          authorUrn,
          firstMediaUrl,
          true
        );
        shareMediaCategory = 'VIDEO';
        media = [{ status: 'READY', media: assetUrn, title: { text: 'AlphaClone Video' } }];
      } else {
        shareMediaCategory = 'IMAGE';
        for (let i = 0; i < mediaUrls.length; i++) {
          const assetUrn = await registerAndUploadLinkedInMedia(
            integration.accessToken,
            authorUrn,
            mediaUrls[i],
            false
          );
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

    const dup = await findRecentDuplicateLinkedInCaption(admin, post.tenant_id, post.user_id, post.caption, 7);
    if (dup) {
      return { ok: false, platform: 'linkedin', reason: 'Duplicate post detected in the last 7 days.' };
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

    const res = await linkedInFetch(
      'https://api.linkedin.com/v2/ugcPosts',
      integration.accessToken,
      { method: 'POST', body: JSON.stringify(payload) },
      { timeoutMs: 25000 }
    );

    const rawBody = await res.text();
    const postUrn = parseLinkedInUgcPostUrn(res, rawBody);
    const patch: Record<string, unknown> = {
      linkedin_post_urn: postUrn,
      linkedin_member_id: canPostAsCompany ? null : integration.linkedin_member_id || post.linkedin_member_id || null,
      linkedin_organization_id: canPostAsCompany ? requestedOrganizationId : null,
      linkedin_author_urn: authorUrn,
    };

    const retry = await updateSocialPostLinkedInUrnWithRetry(admin, postId, patch);
    if (!retry.ok) {
      const retry2 = await updateSocialPostLinkedInUrnWithRetry(admin, postId, { linkedin_post_urn: postUrn });
      if (!retry2.ok && postUrn) {
        await enqueueSocialPostSync(admin, {
          socialPostId: postId,
          tenantId: post.tenant_id,
          platform: 'linkedin',
          externalId: postUrn,
          lastError: retry.error || retry2.error,
        });
      }
    }

    return { ok: true, platform: 'linkedin', postUrn };
  } catch (err) {
    if (err instanceof LinkedInApiError && err.code === 'TOKEN_EXPIRED') {
      const post = await loadSocialPost(admin, postId);
      if (post) {
        const integration = await getLinkedInIntegrationWithToken(admin, {
          tenantId: post.tenant_id,
          userId: post.user_id,
          linkedinMemberId: post.linkedin_member_id,
        });
        if (integration?.id) {
          await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired_on_publish');
        }
      }
      return { ok: false, platform: 'linkedin', reason: 'LinkedIn token expired. Reconnect your account.' };
    }
    console.error('[publishLinkedInPost] error:', err);
    return {
      ok: false,
      platform: 'linkedin',
      reason: err instanceof Error ? err.message : 'LinkedIn publish failed',
    };
  }
}
