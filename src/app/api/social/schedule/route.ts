import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { start } from 'workflow/api';
import { socialScheduleWorkflow } from '../../../../../workflows/social-schedule';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import {
  enqueueSocialPostSync,
  findRecentDuplicateLinkedInCaption,
  parseLinkedInUgcPostUrn,
  updateSocialPostLinkedInUrnWithRetry,
} from '@/lib/social/linkedinPublishHelpers';

type SchedulePayload = {
  tenantId?: string;
  title?: string;
  caption?: string;
  platforms?: string[];
  media_urls?: string[];
  media_types?: string[];
  link_url?: string | null;
  hashtags?: string[];
  scheduled_at?: string | null;
  facebook_page_id?: string | null;
  linkedin_member_id?: string | null;
  linkedin_organization_id?: string | null;
  publish_now?: boolean;
};

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

function getMissingColumnName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code !== '42703' || !maybeError.message) return null;
  const match = maybeError.message.match(/column "([^"]+)"/i);
  return match?.[1] || null;
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

async function ensureTenantMembership(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

async function insertSocialPostWithFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: Record<string, unknown>
) {
  const mutablePayload: Record<string, unknown> = { ...payload };
  const maxAttempts = 10;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const insertRes = await supabase
      .from('social_posts')
      .insert(mutablePayload)
      .select('*')
      .single();

    if (!insertRes.error) {
      return insertRes;
    }

    const missingColumn = getMissingColumnName(insertRes.error);
    if (!missingColumn || !(missingColumn in mutablePayload)) {
      return insertRes;
    }

    delete mutablePayload[missingColumn];
  }

  return await supabase
    .from('social_posts')
    .insert(mutablePayload)
    .select('*')
    .single();
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
    console.error('[social/schedule] publish job error:', err);
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
        reason:
          'Duplicate post: the same caption was published from this workspace in the last 7 days. Change the text or remove the earlier post.',
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
        console.error('[social/schedule] LinkedIn URN persist failed; queued for reconciliation', postId, retry.error);
      }
    }

    return { ok: true, platform: 'linkedin' };
  } catch (err) {
    console.error('[social/schedule] linkedin publish error:', err);
    return { ok: false, platform: 'linkedin', reason: 'LinkedIn publish failed' };
  }
}

async function publishSocialPost(postId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data: post } = await adminClient
    .from('social_posts')
    .select('id, platforms')
    .eq('id', postId)
    .single();

  if (!post) return;

  const platforms = Array.isArray(post.platforms) ? post.platforms : [];
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
      return;
    }
    await adminClient.from('social_posts').update({
      status: 'failed',
      error_message: 'No supported social platform selected',
    }).eq('id', postId);
    return;
  }

  await updateSocialPostStatusWithFallback(adminClient, postId, {
    status: 'publishing',
    error_message: null,
  });
  const results = await Promise.all(jobs);
  const failed = results.filter((r) => !r.ok);
  const succeeded = results.filter((r) => r.ok);

  if (failed.length > 0 && succeeded.length === 0) {
    const message = failed.map((r) => `${r.platform}: ${r.reason || 'failed'}`).join(' | ');
    await updateSocialPostStatusWithFallback(adminClient, postId, {
      status: 'failed',
      error_message: message,
    });
    return;
  }

  if (failed.length > 0 && succeeded.length > 0) {
    const partialMessage = `Partial publish: ${failed
      .map((r) => `${r.platform}: ${r.reason || 'failed'}`)
      .join(' | ')}`;
    await updateSocialPostStatusWithFallback(adminClient, postId, {
      status: 'published',
      published_at: new Date().toISOString(),
      error_message: partialMessage,
    });
    return;
  }

  await updateSocialPostStatusWithFallback(adminClient, postId, {
    status: 'published',
    published_at: new Date().toISOString(),
    error_message: null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as SchedulePayload;
    const tenantId = body.tenantId?.trim();

    if (!tenantId || !body.caption?.trim()) {
      return NextResponse.json({ error: 'tenantId and caption are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    const requestedOrganizationId = body.linkedin_organization_id?.trim() || null;
    if (requestedOrganizationId) {
      const { data: liIntegration, error: liError } = await supabase
        .from('linkedin_integrations')
        .select('metadata')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (liError || !liIntegration) {
        return NextResponse.json({ error: 'LinkedIn integration is not connected for this workspace.' }, { status: 400 });
      }
      const companyPages = extractCompanyPagesFromMetadata(liIntegration.metadata);
      const hasCompany = companyPages.some((company) => company.id === requestedOrganizationId);
      if (!hasCompany) {
        return NextResponse.json({ error: 'Selected LinkedIn company page does not belong to this connected account.' }, { status: 400 });
      }
    }

    const parsedScheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
    if (parsedScheduledAt && Number.isNaN(parsedScheduledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled_at date value' }, { status: 400 });
    }
    const scheduledAt = parsedScheduledAt ? parsedScheduledAt.toISOString() : null;
    const shouldPublishNow = body.publish_now === true || !scheduledAt;

    // Use a legacy-safe insert status; some deployments still enforce
    // an older social_posts_status_check that rejects "queued".
    const status = 'scheduled';

    const insertPayload = {
      tenant_id: tenantId,
      user_id: user.id,
      title: body.title?.trim() || null,
      caption: body.caption.trim(),
      platforms: body.platforms?.length ? body.platforms : ['facebook'],
      media_urls: body.media_urls || [],
      media_types: body.media_types || [],
      link_url: body.link_url || null,
      hashtags: body.hashtags || [],
      status,
      scheduled_at: shouldPublishNow ? null : scheduledAt,
      facebook_page_id: body.facebook_page_id || null,
      linkedin_member_id: body.linkedin_member_id || null,
      linkedin_organization_id: requestedOrganizationId,
    };

    const { data: post, error } = await insertSocialPostWithFallback(supabase, insertPayload);

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.POST' });

    const { workflowRunId } = await start(socialScheduleWorkflow, [{ postId: post.id, tenantId }]);

    return NextResponse.json({ success: true, post, workflowRunId });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.POST' });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId')?.trim();
    const pageId = searchParams.get('pageId')?.trim();

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (pageId) query = query.eq('facebook_page_id', pageId);

    const { data, error } = await query;
    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.GET' });

    return NextResponse.json({ posts: data || [] });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.GET' });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      postId?: string;
      tenantId?: string;
      action?: 'publish_now' | 'cancel';
    };

    if (!body.postId || !body.tenantId || !body.action) {
      return NextResponse.json({ error: 'postId, tenantId, action are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, body.tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    if (body.action === 'cancel') {
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'cancelled' })
        .eq('id', body.postId)
        .eq('tenant_id', body.tenantId);
      if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.PATCH' });
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('social_posts')
      .update({ status: 'scheduled', scheduled_at: null, error_message: null })
      .eq('id', body.postId)
      .eq('tenant_id', body.tenantId);

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.PATCH' });

    await publishSocialPost(body.postId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.PATCH' });
  }
}
