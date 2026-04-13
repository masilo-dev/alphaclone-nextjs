import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get('pageId');
  const limit  = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 });

  // Get integration token
  const { data: integration } = await supabase
    .from('facebook_integrations')
    .select('page_access_token, user_access_token, tenant_id, metadata')
    .eq('user_id', user.id)
    .eq('page_id', pageId)
    .eq('is_active', true)
    .single();

  // Personal profile connection can be valid but has no page feed endpoint.
  if (integration?.metadata?.no_pages) {
    return NextResponse.json({
      success: true,
      posts: [],
      note: 'Personal account connection has no Facebook Page feed. Connect a Page to load posts.',
    });
  }

  const token = integration?.page_access_token || integration?.user_access_token;
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
      'created_time', 'type',
      'likes.summary(true)',
      'comments.summary(true)',
      'shares',
    ].join(',');

    const graphUrl = `https://graph.facebook.com/v19.0/${pageId}/feed?fields=${fields}&limit=${limit}&access_token=${token}`;
    const res = await fetch(graphUrl, { next: { revalidate: 0 } });
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

    const posts = (fbData.data || []) as any[];

    // Upsert into facebook_page_posts for historical tracking
    if (posts.length > 0) {
      const rows = posts.map((p: any) => ({
        tenant_id:      integration.tenant_id || null,
        page_id:        pageId,
        fb_post_id:     p.id,
        message:        p.message || null,
        story:          p.story || null,
        full_picture:   p.full_picture || null,
        permalink_url:  p.permalink_url || null,
        post_type:      p.type || 'post',
        likes_count:    p.likes?.summary?.total_count || 0,
        comments_count: p.comments?.summary?.total_count || 0,
        shares_count:   p.shares?.count || 0,
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
