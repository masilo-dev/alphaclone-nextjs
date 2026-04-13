import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function publishToFacebook(postId: string) {
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: post, error: postError } = await adminClient
      .from('social_posts')
      .select('id, tenant_id, facebook_page_id, caption, link_url, media_urls')
      .eq('id', postId)
      .single();

    if (postError || !post) return { ok: false, reason: 'post_not_found' as const };
    if (!post.facebook_page_id) {
      await adminClient
        .from('social_posts')
        .update({ status: 'failed', error_message: 'facebook_page_id is required to publish' })
        .eq('id', postId);
      return { ok: false, reason: 'missing_page_id' as const };
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
      await adminClient
        .from('social_posts')
        .update({ status: 'failed', error_message: 'Facebook page is not connected' })
        .eq('id', postId);
      return { ok: false, reason: 'integration_missing' as const };
    }

    await adminClient.from('social_posts').update({ status: 'publishing', error_message: null }).eq('id', postId);

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
      await adminClient
        .from('social_posts')
        .update({
          status: 'failed',
          error_message: result?.error?.message || 'Facebook publish failed',
        })
        .eq('id', postId);
      return { ok: false, reason: 'graph_error' as const };
    }

    await adminClient
      .from('social_posts')
      .update({
        status: 'published',
        facebook_post_id: result.id || result.post_id || null,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', postId);
    return { ok: true as const };
  } catch (err) {
    console.error('[cron/social-publish] publish error:', err);
    await adminClient
      .from('social_posts')
      .update({ status: 'failed', error_message: 'Publish job failed' })
      .eq('id', postId);
    return { ok: false, reason: 'exception' as const };
  }
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
      const r = await publishToFacebook(row.id);
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
