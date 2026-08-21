import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';
import { facebookService } from '@/services/facebookService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { pageId, message, mediaUrl, mediaType, tenantId } = await req.json();

    if (!pageId || !message) {
      return NextResponse.json({ error: 'pageId and message are required' }, { status: 400 });
    }

    const result = await facebookService.publishPost(
      tenantId,
      pageId,
      message,
      mediaUrl,
      mediaType || 'image'
    );

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'facebook/posts.POST' });
  }
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2): Promise<Response> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (error: any) {
      clearTimeout(timeout);
      lastError = error;
      const causeCode = error?.cause?.code;
      const retryable = causeCode === 'UND_ERR_SOCKET' || error?.name === 'AbortError';
      if (!retryable || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get('pageId');
  const limit  = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const after = searchParams.get('after');

  if (!pageId) {
    return NextResponse.json({
      success: true,
      posts: [],
      note: 'No page selected.',
    });
  }

  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegration(admin, { userId: user.id, pageId });

  // Personal profile connection can be valid but has no page feed endpoint.
  if (integration?.metadata?.no_pages) {
    return NextResponse.json({
      success: true,
      posts: [],
      note: 'Personal account connection has no Facebook Page feed. Connect a Page to load posts.',
    });
  }

  const tokens = integration ? await getFacebookTokens(admin, integration) : { pageAccessToken: null, userAccessToken: null };
  const token = tokens.pageAccessToken || tokens.userAccessToken;
  if (!token) {
    return NextResponse.json({
      success: true,
      posts: [],
      note: 'No page token available for this connection.',
      action: 'reconnect',
    });
  }

  try {
    const fields = [
      'id', 'message', 'story', 'full_picture', 'permalink_url',
      'created_time',
      'reactions.summary(true)',
      'comments.summary(true)',
      'shares',
    ].join(',');

    const cursorParam = after ? `&after=${encodeURIComponent(after)}` : '';
    const graphUrl = `https://graph.facebook.com/v21.0/${pageId}/feed?fields=${fields}&limit=${limit}${cursorParam}&access_token=${token}`;
    const res = await fetchWithRetry(graphUrl, { next: { revalidate: 0 } });
    const fbData = await res.json();

    if (fbData.error) {
      console.error('[Facebook Posts] Graph API error:', fbData.error);
      const isAuthError = fbData.error.code === 190 || fbData.error.code === 102 || fbData.error.message?.includes('access token');
      return NextResponse.json({
        success: true,
        posts: [],
        note: 'Facebook could not load posts for this connection.',
        code: 'FACEBOOK_GRAPH_ERROR',
        action: isAuthError ? 'reconnect' : undefined,
      });
    }

    const posts = ((fbData.data || []) as any[]).map((post: any) => {
      const insightRows = Array.isArray(post.insights?.data) ? post.insights.data : [];
      const insightMap = insightRows.reduce((acc: Record<string, unknown>, row: any) => {
        acc[row.name] = row.values?.[0]?.value ?? 0;
        return acc;
      }, {});
      return { ...post, insights: insightMap };
    });

    // Upsert into facebook_page_posts for historical tracking
    if (posts.length > 0) {
      const rows = posts.map((p: any) => ({
        tenant_id:      integration?.tenant_id || null,
        page_id:        pageId,
        fb_post_id:     p.id,
        message:        p.message || null,
        story:          p.story || null,
        full_picture:   p.full_picture || null,
        permalink_url:  p.permalink_url || null,
        post_type:      p.type || 'post',
        likes_count:    p.reactions?.summary?.total_count || 0,
        comments_count: p.comments?.summary?.total_count || 0,
        shares_count:   p.shares?.count || 0,
        metadata:       { insights: p.insights || {} },
        created_time:   p.created_time || null,
        fetched_at:     new Date().toISOString(),
      }));

      await supabase
        .from('facebook_page_posts')
        .upsert(rows, { onConflict: 'fb_post_id', ignoreDuplicates: false });
    }

    return NextResponse.json({
      success: true,
      posts,
      paging: fbData.paging || null,
    });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'facebook/posts.GET' });
  }
}
