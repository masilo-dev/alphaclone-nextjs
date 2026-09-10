import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get('pageId');
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!pageId || !tenantId) return NextResponse.json({ error: 'pageId and tenantId are required' }, { status: 400 });
  const { data: membership } = await supabase.from('tenant_users').select('tenant_id')
    .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegration(admin, { tenantId, userId: user.id, pageId });

  const tokens = integration ? await getFacebookTokens(admin, integration) : { pageAccessToken: null, userAccessToken: null };
  const token = tokens.pageAccessToken || tokens.userAccessToken;
  if (!token) {
    return NextResponse.json({
      success: false,
      connected: Boolean(integration?.is_active),
      error: integration?.is_active
        ? 'Facebook connected — page profile metrics are unavailable.'
        : 'Facebook connection is inactive.',
      page: null,
    });
  }

  try {
    const fields = [
      'id',
      'name',
      'username',
      'category',
      'about',
      'website',
      'phone',
      'followers_count',
      'talking_about_count',
      'picture{url}',
    ].join(',');

    const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);
    const data = await response.json();

    if (!response.ok || data?.error) {
      return NextResponse.json({
        success: false,
        connected: true,
        error: 'Facebook could not load page info.',
        detail: data?.error || null,
        page: null,
      });
    }

    return NextResponse.json({ success: true, page: data });
  } catch (err: any) {
    return clientErrorResponse(err, { request: req, scope: 'facebook/page-info.GET' });
  }
}
