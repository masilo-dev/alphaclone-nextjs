import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

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

function readCount(value: unknown): number {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : 0;
}

function extractLikesCount(payload: Record<string, any>): number {
  return (
    readCount(payload?.likesSummary?.totalLikes) ||
    readCount(payload?.likesSummary?.count) ||
    readCount(payload?.totalLikes) ||
    readCount(payload?.numLikes) ||
    readCount(payload?.likes)
  );
}

function extractCommentsCount(payload: Record<string, any>): number {
  return (
    readCount(payload?.commentsSummary?.totalComments) ||
    readCount(payload?.commentsSummary?.count) ||
    readCount(payload?.totalComments) ||
    readCount(payload?.numComments) ||
    readCount(payload?.comments)
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      tenantId?: string;
      postUrn?: string;
      linkedinMemberId?: string;
    };
    const tenantId = String(body.tenantId || '').trim();
    const postUrn = String(body.postUrn || '').trim();
    const linkedinMemberId = String(body.linkedinMemberId || '').trim();

    if (!tenantId || !postUrn) {
      return NextResponse.json({ error: 'tenantId and postUrn are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('linkedin_integrations')
      .select('access_token')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);
    if (linkedinMemberId) query = query.eq('linkedin_member_id', linkedinMemberId);
    const { data: li, error: liError } = await query.maybeSingle();

    if (liError || !li?.access_token) {
      return NextResponse.json({ error: 'LinkedIn is not connected for this workspace.' }, { status: 400 });
    }

    const socialActionUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`;
    const socialActionRes = await fetch(socialActionUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${li.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    const payload = (await socialActionRes.json().catch(() => ({}))) as Record<string, any>;
    if (!socialActionRes.ok) {
      return NextResponse.json({ success: true, likesCount: 0, commentsCount: 0 });
    }

    return NextResponse.json({
      success: true,
      likesCount: extractLikesCount(payload),
      commentsCount: extractCommentsCount(payload),
    });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/engagement.POST' });
  }
}
