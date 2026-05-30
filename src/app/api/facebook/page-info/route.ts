import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 });

  const { data: integration } = await supabase
    .from('facebook_integrations')
    .select('page_access_token, user_access_token')
    .eq('user_id', user.id)
    .eq('page_id', pageId)
    .eq('is_active', true)
    .single();

  const token = integration?.page_access_token || integration?.user_access_token;
  if (!token) {
    return NextResponse.json({ error: 'Facebook page not connected or token missing — please reconnect' }, { status: 400 });
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

    const response = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);
    const data = await response.json();

    if (!response.ok || data?.error) {
      return NextResponse.json({ error: 'Facebook could not load page info.', detail: data?.error || null }, { status: 400 });
    }

    return NextResponse.json({ success: true, page: data });
  } catch (err: any) {
    return clientErrorResponse(err, { request: req, scope: 'facebook/page-info.GET' });
  }
}
