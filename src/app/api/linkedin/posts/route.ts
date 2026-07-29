import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

function normalizePostRow(row: Record<string, unknown>) {
<<<<<<< HEAD
  const metadata =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : null;
  const analytics =
    row.analytics && typeof row.analytics === 'object'
      ? (row.analytics as Record<string, unknown>)
      : null;
  const orgFromRow = typeof row.linkedin_organization_id === 'string' ? row.linkedin_organization_id : null;
  const orgFromMeta =
    metadata && typeof metadata.linkedin_organization_id === 'string'
      ? metadata.linkedin_organization_id
      : null;
  const orgFromAnalytics =
    analytics && typeof analytics.linkedin_organization_id === 'string'
      ? analytics.linkedin_organization_id
      : null;

=======
>>>>>>> origin/main
  return {
    ...row,
    linkedin_post_urn: row.linkedin_post_urn || null,
    linkedin_member_id: row.linkedin_member_id || null,
<<<<<<< HEAD
    linkedin_organization_id: orgFromRow || orgFromMeta || orgFromAnalytics || null,
    external_id: row.external_id || null,
    analytics: row.analytics || null,
    metadata,
=======
    external_id: row.external_id || null,
    analytics: row.analytics || null,
>>>>>>> origin/main
  };
}

async function ensureTenantMembership(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !error && !!data;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = String(searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    // Best-effort backfill for legacy published rows where URN exists in queue but was never persisted.
    const admin = createSupabaseAdminClient();
    const { data: pendingSyncRows } = await admin
      .from('social_post_sync_queue')
      .select('id, social_post_id, external_id')
      .eq('tenant_id', tenantId)
      .eq('platform', 'linkedin')
      .is('processed_at', null)
      .limit(30);

    for (const row of pendingSyncRows || []) {
      const externalUrn = String(row.external_id || '').trim();
      if (!externalUrn || !row.social_post_id) continue;
      await admin
        .from('social_posts')
        .update({
          linkedin_post_urn: externalUrn,
          analytics: { linkedin_post_urn: externalUrn },
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', row.social_post_id);
      await admin
        .from('social_post_sync_queue')
        .update({ processed_at: new Date().toISOString(), attempts: 1 })
        .eq('id', row.id);
    }

    const selectVariants = [
<<<<<<< HEAD
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,linkedin_organization_id,external_id,analytics,metadata,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,linkedin_organization_id,external_id,analytics,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,external_id,analytics,error_message,platforms',
=======
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,external_id,analytics,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,external_id,error_message,platforms',
>>>>>>> origin/main
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,analytics,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,error_message,platforms',
    ];

    let lastError: unknown = null;
    for (const select of selectVariants) {
      const query = await supabase
        .from('social_posts')
        .select(select)
        .eq('tenant_id', tenantId)
        .filter('platforms', 'cs', '{"linkedin"}')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!query.error) {
        const rows = (query.data || []).map((row: unknown) => normalizePostRow(row as Record<string, unknown>));
        return NextResponse.json({ success: true, posts: rows, selectUsed: select });
      }
      lastError = query.error;
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load LinkedIn posts from social_posts',
        details: (lastError as { message?: string } | null)?.message || null,
      },
      { status: 500 }
    );
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/posts.GET' });
  }
}
