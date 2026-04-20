import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

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

async function updateSocialPostStatusWithFallback(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  postId: string,
  payload: Record<string, unknown>
) {
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

    const { data: integration, error: intError } = await adminClient
      .from('facebook_integrations')
      .select('page_access_token')
      .eq('tenant_id', post.tenant_id)
      .eq('page_id', post.facebook_page_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (intError || !integration?.page_access_token) {
      return { ok: false, platform: 'facebook', reason: 'integration_missing' };
    }

    const mediaUrl = Array.isArray(post.media_urls) ? post.media_urls[0] : undefined;
    const mediaType = Array.isArray(post.media_types) ? String(post.media_types[0] || '').toLowerCase() : '';
    const isVideo = mediaType === 'video' || (typeof mediaUrl === 'string' && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(mediaUrl));
    const fbBody: Record<string, string> = {
      message: post.caption,
      access_token: integration.page_access_token,
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
      return { ok: false, platform: 'facebook', reason: result?.error?.message || 'Facebook publish failed' };
    }

    await adminClient
      .from('social_posts')
      .update({
        facebook_post_id: result.id || result.post_id || null,
      })
      .eq('id', postId);
    return { ok: true, platform: 'facebook' };
  } catch (err) {
    console.error('[cron/social-publish] publish error:', err);
    return { ok: false, platform: 'facebook', reason: 'Publish job failed' };
  }
}

async function publishToLinkedIn(postId: string): Promise<PublishResult> {
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
    const companyPages = Array.isArray((activeIntegration as any)?.metadata?.company_pages)
      ? ((activeIntegration as any).metadata.company_pages as Array<Record<string, unknown>>)
      : [];
    const selectedCompany = requestedOrganizationId
      ? companyPages.find((page) => String(page?.id || '') === requestedOrganizationId)
      : null;
    const canPostAsCompany = !!selectedCompany && scopes.includes('w_organization_social');
    const authorUrn = canPostAsCompany
      ? `urn:li:organization:${requestedOrganizationId}`
      : activeIntegration.linkedin_person_urn;

    async function registerAndUploadLinkedInImage(authorUrn: string, imageUrl: string): Promise<string> {
      const imageFetch = await fetchWithTimeout(imageUrl, { method: 'GET' }, 25000);
      if (!imageFetch.ok) {
        throw new Error(`Could not download image URL (${imageFetch.status})`);
      }
      const contentType = imageFetch.headers.get('content-type') || 'image/jpeg';
      const imageBuffer = await imageFetch.arrayBuffer();

      const registerRes = await fetchWithTimeout('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeIntegration.access_token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: authorUrn,
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
        body: imageBuffer,
      }, 30000);

      if (!uploadRes.ok) {
        throw new Error(`LinkedIn image upload failed (${uploadRes.status})`);
      }

      return assetUrn;
    }

    const hasLink = typeof post.link_url === 'string' && post.link_url.trim().length > 0;
    const imageUrl = Array.isArray(post.media_urls) && post.media_urls.length > 0
      ? String(post.media_urls[0] || '').trim()
      : '';
    const hasImage = imageUrl.length > 0;
    let shareMediaCategory: 'NONE' | 'ARTICLE' | 'IMAGE' = 'NONE';
    let media: Array<Record<string, unknown>> = [];
    if (hasImage) {
      const assetUrn = await registerAndUploadLinkedInImage(authorUrn, imageUrl);
      shareMediaCategory = 'IMAGE';
      media = [{
        status: 'READY',
        media: assetUrn,
        title: { text: 'AlphaClone Image' },
      }];
    } else if (hasLink) {
      shareMediaCategory = 'ARTICLE';
      media = [{ status: 'READY', originalUrl: post.link_url }];
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
      return { ok: false, platform: 'linkedin', reason: rawBody || `LinkedIn publish failed (${res.status})` };
    }

    const postUrn = res.headers.get('x-restli-id') ?? null;
    const updateRes = await adminClient.from('social_posts').update({
      linkedin_post_urn: postUrn,
      linkedin_member_id: activeIntegration.linkedin_member_id || post.linkedin_member_id || null,
      linkedin_organization_id: canPostAsCompany ? requestedOrganizationId : null,
    }).eq('id', postId);
    if (isMissingColumn(updateRes.error, 'linkedin_member_id') || isMissingColumn(updateRes.error, 'linkedin_organization_id')) {
      await adminClient.from('social_posts').update({
        linkedin_post_urn: postUrn,
      }).eq('id', postId);
    }
    return { ok: true, platform: 'linkedin' };
  } catch (err) {
    console.error('[cron/social-publish] linkedin publish error:', err);
    return { ok: false, platform: 'linkedin', reason: 'LinkedIn publish failed' };
  }
}

async function publishSocialPost(postId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data: post } = await adminClient.from('social_posts').select('platforms').eq('id', postId).single();
  const platforms = Array.isArray(post?.platforms) ? post.platforms : [];
  const jobs: Promise<PublishResult>[] = [];
  if (platforms.includes('facebook')) jobs.push(publishToFacebook(postId));
  if (platforms.includes('linkedin')) jobs.push(publishToLinkedIn(postId));

  if (jobs.length === 0) {
    if (platforms.includes('platform')) {
      await adminClient.from('social_posts').update({
        status: 'published',
        published_at: new Date().toISOString(),
        error_message: null,
      }).eq('id', postId);
      return { ok: true };
    }
    await adminClient.from('social_posts').update({
      status: 'failed',
      error_message: 'No supported social platform selected',
    }).eq('id', postId);
    return { ok: false };
  }

  await updateSocialPostStatusWithFallback(adminClient, postId, { status: 'publishing', error_message: null });
  const results = await Promise.all(jobs);
  const failed = results.filter((r) => !r.ok);
  const succeeded = results.filter((r) => r.ok);
  if (failed.length > 0 && succeeded.length === 0) {
    await updateSocialPostStatusWithFallback(adminClient, postId, {
      status: 'failed',
      error_message: failed.map((r) => `${r.platform}: ${r.reason || 'failed'}`).join(' | '),
    });
    return { ok: false };
  }
  if (failed.length > 0 && succeeded.length > 0) {
    await updateSocialPostStatusWithFallback(adminClient, postId, {
      status: 'published',
      published_at: new Date().toISOString(),
      error_message: `Partial publish: ${failed.map((r) => `${r.platform}: ${r.reason || 'failed'}`).join(' | ')}`,
    });
    return { ok: true };
  }

  await updateSocialPostStatusWithFallback(adminClient, postId, {
    status: 'published',
    published_at: new Date().toISOString(),
    error_message: null,
  });
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const { data: duePosts, error } = await admin
      .from('social_posts')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(25);

    if (error) throw error;
    if (!duePosts?.length) {
      return NextResponse.json({ success: true, processed: 0, published: 0, failed: 0 });
    }

    const results = [];
    let published = 0;
    let failed = 0;
    for (const row of duePosts) {
      const r = await publishSocialPost(row.id);
      results.push({ id: row.id, ...r });
      if (r.ok) published += 1;
      else failed += 1;
    }

    return NextResponse.json({
      success: true,
      processed: duePosts.length,
      published,
      failed,
      results,
    });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'cron/social-publish.GET' });
  }
}
