import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getSocialPublishingService } from '@/lib/social/SocialPublishingService';

export const runtime = 'nodejs';

type SocialPostRow = {
  id: string;
  facebook_post_id?: string | null;
  caption?: string | null;
  media_types?: string[] | null;
  media_urls?: string[] | null;
  live_url?: string | null;
  created_at: string;
  [key: string]: unknown;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { pageId, message, mediaUrl, mediaType, tenantId } = await req.json();

    if (!pageId || !message) {
      return NextResponse.json({ error: 'pageId and message are required' }, { status: 400 });
    }

    const { data: membership } = await supabase.from('tenant_users').select('tenant_id')
      .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const result = await getSocialPublishingService().publish({
      tenantId, userId: user.id, platform: 'facebook', identityType: 'facebook_page',
      identityId: pageId, caption: message, mediaUrls: mediaUrl ? [mediaUrl] : [], publishNow: true,
    });
    return NextResponse.json({ success: result.ok, result }, { status: result.ok ? 200 : 422 });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'facebook/posts.POST' });
  }
}

/** social_posts is the publishing ledger. facebook_page_posts is a legacy import cache only. */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
  const { data: membership } = await supabase.from('tenant_users').select('tenant_id')
    .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pageId = req.nextUrl.searchParams.get('pageId');
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('after')) || 0);
  const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get('limit')) || 20));
  let query = supabase.from('social_posts').select('*').eq('tenant_id', tenantId)
    .or('provider.eq.facebook,platform.eq.facebook,platforms.cs.{facebook}')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit);
  if (pageId) query = query.eq('facebook_page_id', pageId);
  const { data, error } = await query;
  if (error) return clientErrorResponse(error, { request: req, scope: 'facebook/posts.GET' });
  const rows = (data || []) as SocialPostRow[];
  const posts = rows.slice(0, limit).map((post) => ({
    ...post,
    id: post.facebook_post_id || post.id,
    social_post_id: post.id,
    message: post.caption,
    full_picture: post.media_types?.[0] === 'video' ? null : post.media_urls?.[0],
    permalink_url: post.live_url,
    created_time: post.created_at,
  }));
  return NextResponse.json({
    success: true,
    posts,
    paging: rows.length > limit
      ? { cursors: { after: String(offset + limit) } }
      : null,
  });
}
