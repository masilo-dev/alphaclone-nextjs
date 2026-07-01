import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegration, getFacebookTokens } from '@/services/facebook/facebookIntegrationService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const integration = await getFacebookIntegration(admin, { userId: user.id, pageId });

  if (!integration) {
    return NextResponse.json({ error: 'Facebook page not connected', action: 'reconnect' }, { status: 404 });
  }

  const tokens = await getFacebookTokens(admin, integration);
  const tasks = Array.isArray(integration.metadata?.page_tasks)
    ? integration.metadata.page_tasks.map((task: unknown) => String(task))
    : [];
  const canCreateContent = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE') || tasks.includes('ADVERTISE');
  const hasPageToken = Boolean(tokens.pageAccessToken);

  const checks = {
    publish_posts: hasPageToken && canCreateContent,
    upload_media: hasPageToken && canCreateContent,
    delete_posts: hasPageToken && canCreateContent,
    read_posts: hasPageToken,
    read_insights: hasPageToken,
    read_comments: hasPageToken,
    manage_comments: hasPageToken && canCreateContent,
    messenger: hasPageToken,
    leads: hasPageToken,
  };

  return NextResponse.json({
    success: true,
    page_id: integration.page_id,
    page_name: integration.page_name,
    scope_mode: integration.metadata?.scope_mode || 'advanced',
    requested_scopes: integration.metadata?.requested_scopes || [],
    page_tasks: tasks,
    can_post: checks.publish_posts,
    capabilities: checks,
    note: checks.publish_posts
      ? 'This page has a Page token and Meta page task permissions stored in AlphaClone.'
      : 'Meta did not return page publishing task permissions for this page token. Reconnect as a Page admin/editor with advanced permissions.',
  });
}
