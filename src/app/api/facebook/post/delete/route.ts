import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
<<<<<<< HEAD
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';
=======
>>>>>>> origin/main

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pageId, postId } = await req.json();
  if (!pageId || !postId) {
    return NextResponse.json({ error: 'pageId and postId are required' }, { status: 400 });
  }

<<<<<<< HEAD
  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegrationWithToken(admin, { userId: user.id, pageId });

  if (!integration?.pageAccessToken || integration?.metadata?.no_pages) {
=======
  const { data: integration } = await supabase
    .from('facebook_integrations')
    .select('page_access_token, metadata')
    .eq('user_id', user.id)
    .eq('page_id', pageId)
    .eq('is_active', true)
    .single();

  if (!integration?.page_access_token || integration?.metadata?.no_pages) {
>>>>>>> origin/main
    return NextResponse.json({
      error: 'Facebook Page token missing. Reconnect with advanced Page permissions.',
      action: 'reconnect',
    }, { status: 400 });
  }

<<<<<<< HEAD
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(integration.pageAccessToken)}`;
=======
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(integration.page_access_token)}`;
>>>>>>> origin/main
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.error) {
    const message = String(data?.error?.message || 'Facebook post delete failed');
    const permissionIssue =
      data?.error?.code === 190 ||
      data?.error?.code === 200 ||
      message.includes('pages_manage_posts') ||
      message.includes('permission');
    return NextResponse.json({
      error: message,
      code: permissionIssue ? 'FACEBOOK_PERMISSION' : 'FACEBOOK_GRAPH_ERROR',
      action: permissionIssue ? 'reconnect' : undefined,
    }, { status: permissionIssue ? 403 : 400 });
  }

  await supabase
    .from('facebook_page_posts')
    .delete()
    .eq('fb_post_id', postId)
    .eq('page_id', pageId);

  return NextResponse.json({ success: true, deleted: Boolean(data?.success ?? true) });
}
