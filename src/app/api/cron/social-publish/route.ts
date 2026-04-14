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

async function publishToFacebook(postId: string): Promise<PublishResult> {
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: post, error: postError } = await adminClient
      .from('social_posts')
      .select('id, tenant_id, facebook_page_id, caption, link_url, media_urls')
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

    const imageUrl = Array.isArray(post.media_urls) ? post.media_urls[0] : undefined;
    const fbBody: Record<string, string> = {
      message: post.caption,
      access_token: integration.page_access_token,
    };

    if (post.link_url) fbBody.link = post.link_url;
    if (imageUrl) fbBody.url = String(imageUrl);

    const endpoint = imageUrl
      ? `https://graph.facebook.com/v19.0/${post.facebook_page_id}/photos`
      : `https://graph.facebook.com/v19.0/${post.facebook_page_id}/feed`;

    const res = await fetch(endpoint, {
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
    const { data: post, error: postError } = await adminClient
      .from('social_posts')
      .select('id, tenant_id, user_id, caption, link_url, linkedin_member_id')
      .eq('id', postId)
      .single();
    if (postError || !post) return { ok: false, platform: 'linkedin', reason: 'post_not_found' };

    const { data: li, error: liError } = await adminClient
      .from('linkedin_integrations')
      .select('linkedin_member_id, linkedin_person_urn, access_token, scopes')
      .eq('tenant_id', post.tenant_id)
      .eq('user_id', post.user_id)
      .eq('linkedin_member_id', post.linkedin_member_id || '')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const integration = li?.access_token ? li : await (async () => {
      const fallback = await adminClient
        .from('linkedin_integrations')
        .select('linkedin_member_id, linkedin_person_urn, access_token, scopes')
        .eq('tenant_id', post.tenant_id)
        .eq('user_id', post.user_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return fallback.data;
    })();

    if (liError || !integration?.access_token || !integration?.linkedin_person_urn) {
      return { ok: false, platform: 'linkedin', reason: 'LinkedIn account is not connected' };
    }

    const scopes = Array.isArray(integration.scopes) ? integration.scopes : [];
    if (!scopes.includes('w_member_social')) {
      return { ok: false, platform: 'linkedin', reason: 'LinkedIn is missing w_member_social scope' };
    }

    const hasLink = typeof post.link_url === 'string' && post.link_url.trim().length > 0;
    const payload = {
      author: integration.linkedin_person_urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.caption },
          shareMediaCategory: hasLink ? 'ARTICLE' : 'NONE',
          media: hasLink ? [{ status: 'READY', originalUrl: post.link_url }] : [],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    });
    const rawBody = await res.text();
    if (!res.ok) {
      return { ok: false, platform: 'linkedin', reason: rawBody || `LinkedIn publish failed (${res.status})` };
    }

    const postUrn = res.headers.get('x-restli-id') ?? null;
    await adminClient.from('social_posts').update({
      linkedin_post_urn: postUrn,
      linkedin_member_id: integration.linkedin_member_id || post.linkedin_member_id || null,
    }).eq('id', postId);
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

  await adminClient.from('social_posts').update({ status: 'publishing', error_message: null }).eq('id', postId);
  const results = await Promise.all(jobs);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    await adminClient.from('social_posts').update({
      status: 'failed',
      error_message: failed.map((r) => `${r.platform}: ${r.reason || 'failed'}`).join(' | '),
    }).eq('id', postId);
    return { ok: false };
  }

  await adminClient.from('social_posts').update({
    status: 'published',
    published_at: new Date().toISOString(),
    error_message: null,
  }).eq('id', postId);
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
