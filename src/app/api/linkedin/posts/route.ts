import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

function normalizePostRow(row: Record<string, unknown>) {
  return {
    ...row,
    linkedin_post_urn: row.linkedin_post_urn || null,
    linkedin_member_id: row.linkedin_member_id || null,
    external_id: row.external_id || null,
    analytics: row.analytics || null,
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

    const selectVariants = [
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,external_id,analytics,error_message,platforms',
      'id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,external_id,error_message,platforms',
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
        const rows = (query.data || []).map((row) => normalizePostRow(row as Record<string, unknown>));
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
