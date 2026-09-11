import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tenantId, pageId, postId } = await req.json();
  if (!tenantId || !pageId || !postId) {
    return NextResponse.json({ error: 'tenantId, pageId and postId are required' }, { status: 400 });
  }
  const { data: membership } = await supabase.from('tenant_users').select('tenant_id')
    .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegrationWithToken(admin, { tenantId, userId: user.id, pageId });

  if (!integration?.pageAccessToken || integration?.metadata?.no_pages) {
    return NextResponse.json({
      error: 'Facebook Page token missing. Reconnect with advanced Page permissions.',
      action: 'reconnect',
    }, { status: 400 });
  }

  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(integration.pageAccessToken)}`;
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

  // Keep the canonical ledger record; provider deletion must not erase history.
  await supabase.from('social_posts').update({ status: 'deleted' })
    .eq('tenant_id', tenantId).eq('facebook_page_id', pageId).eq('facebook_post_id', postId);

  return NextResponse.json({ success: true, deleted: Boolean(data?.success ?? true) });
}
