import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';
import {
  getLinkedInIntegrationWithToken,
  normalizeLinkedInScopes,
} from '@/services/linkedin/linkedinIntegrationService';

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

type InboxItem = {
  postId: string;
  postUrn: string;
  postCaption: string;
  commentUrn: string;
  commentText: string;
  actor: string;
  createdAt: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      tenantId?: string;
      linkedinMemberId?: string;
      limit?: number;
    };

    const tenantId = body.tenantId?.trim();
    const linkedinMemberId = body.linkedinMemberId?.trim();
    const limit = Math.min(Math.max(Number(body.limit || 25), 1), 100);

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const integration = await getLinkedInIntegrationWithToken(admin, {
      tenantId,
      userId: user.id,
      linkedinMemberId: linkedinMemberId || null,
    });

    if (!integration?.accessToken) {
      return NextResponse.json({ error: 'LinkedIn is not connected for this workspace.' }, { status: 400 });
    }

    const scopes = normalizeLinkedInScopes(integration.scopes);
    const canRead =
      scopes.includes('w_member_social') ||
      scopes.includes('w_organization_social') ||
      scopes.includes('r_organization_social');
    if (!canRead) {
      return NextResponse.json({ error: 'Missing LinkedIn scopes for comment inbox.' }, { status: 400 });
    }

    let postsQuery = admin
      .from('social_posts')
      .select('id, caption, linkedin_post_urn, linkedin_member_id, created_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .contains('platforms', ['linkedin'])
      .not('linkedin_post_urn', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (linkedinMemberId) {
      postsQuery = postsQuery.eq('linkedin_member_id', linkedinMemberId);
    }

    const { data: posts, error: postsError } = await postsQuery;
    if (postsError) {
      return NextResponse.json({ error: 'Failed to load LinkedIn posts for inbox.' }, { status: 500 });
    }

    const items: InboxItem[] = [];
    for (const post of posts || []) {
      const postUrn = String(post.linkedin_post_urn || '').trim();
      if (!postUrn) continue;

      try {
        const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=50`;
        const commentRes = await linkedInFetch(url, integration.accessToken, { method: 'GET' }, { retries: 1 });
        const commentJson = await commentRes.json().catch(() => ({}));
        const elements = Array.isArray(commentJson?.elements) ? commentJson.elements : [];

        for (const element of elements) {
          items.push({
            postId: String(post.id),
            postUrn,
            postCaption: String(post.caption || ''),
            commentUrn: String(element?.id || element?.urn || ''),
            commentText: String(element?.message?.text || ''),
            actor: String(element?.actor || ''),
            createdAt: typeof element?.created?.time === 'number' ? element.created.time : null,
          });
        }
      } catch {
        continue;
      }
    }

    const sorted = items
      .filter((item) => item.commentUrn && item.commentText)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      inboxType: 'engagement_comments',
      items: sorted,
      note: 'LinkedIn direct-message inbox is restricted by LinkedIn. This inbox shows engagement comments on your posts.',
    });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/inbox.POST' });
  }
}
