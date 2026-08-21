import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get('pageId');
  const postId = searchParams.get('postId');

  if (!pageId || !postId) {
    return NextResponse.json({ success: false, error: 'pageId and postId are required' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegration(admin, { userId: user.id, pageId });

  if (integration?.metadata?.no_pages) {
    return NextResponse.json({
      success: false,
      note: 'Insights require a Facebook Page connection with read insights permission.',
    });
  }

  const tokens = integration ? await getFacebookTokens(admin, integration) : { pageAccessToken: null, userAccessToken: null };
  const token = tokens.pageAccessToken || tokens.userAccessToken;
  if (!token) {
    return NextResponse.json({ success: false, error: 'No page token' }, { status: 400 });
  }

  const metrics = [
    'post_impressions',
    'post_impressions_unique',
    'post_engaged_users',
    'post_clicks',
  ].join(',');

  try {
    const url = `https://graph.facebook.com/v21.0/${postId}/insights?metric=${metrics}&access_token=${token}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({
        success: false,
        note: data.error.message || 'Facebook insights unavailable for this post or token.',
        code: data.error.code,
      });
    }
    return NextResponse.json({ success: true, insights: data.data || [] });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'facebook/post-insights.GET' });
  }
}
