import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

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
  publish_now?: boolean;
};

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

async function publishToFacebook(postId: string) {
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: post, error: postError } = await adminClient
      .from('social_posts')
      .select('id, tenant_id, facebook_page_id, caption, link_url, media_urls')
      .eq('id', postId)
      .single();

    if (postError || !post) return;
    if (!post.facebook_page_id) {
      await adminClient
        .from('social_posts')
        .update({ status: 'failed', error_message: 'facebook_page_id is required to publish' })
        .eq('id', postId);
      return;
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
      return;
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
      return;
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
  } catch (err) {
    console.error('[social/schedule] publish job error:', err);
    await adminClient
      .from('social_posts')
      .update({ status: 'failed', error_message: 'Publish job failed' })
      .eq('id', postId);
  }
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

    const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at).toISOString() : null;
    const shouldPublishNow = body.publish_now === true || !scheduledAt;

    const status = shouldPublishNow ? 'queued' : 'scheduled';

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
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
      })
      .select('*')
      .single();

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.POST' });

    if (shouldPublishNow) {
      void publishToFacebook(post.id);
    }

    return NextResponse.json({ success: true, post });
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
      .update({ status: 'queued', scheduled_at: null, error_message: null })
      .eq('id', body.postId)
      .eq('tenant_id', body.tenantId);

    if (error) return clientErrorResponse(error, { request: req, scope: 'social/schedule.PATCH' });

    void publishToFacebook(body.postId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'social/schedule.PATCH' });
  }
}
