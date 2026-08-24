import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { linkedInFetch, LinkedInApiError } from '@/lib/linkedin/linkedinClient';
import { getLinkedInIntegrationWithToken, markLinkedInIntegrationInactive } from '@/services/linkedin/linkedinIntegrationService';

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
    const integration = await getLinkedInIntegrationWithToken(admin, {
      tenantId,
      userId: user.id,
      linkedinMemberId: linkedinMemberId || null,
    });

    if (!integration?.accessToken) {
      return NextResponse.json(
        { error: 'LinkedIn is not connected or token expired. Reconnect from Business → LinkedIn.' },
        { status: 400 }
      );
    }

    const socialActionUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`;
    try {
      const socialActionRes = await linkedInFetch(socialActionUrl, integration.accessToken, { method: 'GET' });
      const payload = (await socialActionRes.json().catch(() => ({}))) as Record<string, any>;
      return NextResponse.json({
        success: true,
        likesCount: extractLikesCount(payload),
        commentsCount: extractCommentsCount(payload),
      });
    } catch (err) {
      if (err instanceof LinkedInApiError) {
        if (err.code === 'TOKEN_EXPIRED') {
          await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired_on_engagement');
          return NextResponse.json(
            { error: 'LinkedIn token expired. Reconnect your account.', code: 'LINKEDIN_TOKEN_EXPIRED' },
            { status: 401 }
          );
        }
        if (err.code === 'FORBIDDEN') {
          return NextResponse.json(
            {
              error: 'LinkedIn permission denied for engagement stats. Reconnect and approve all requested permissions.',
              code: 'LINKEDIN_FORBIDDEN',
            },
            { status: 403 }
          );
        }
        if (err.status === 404) {
          return NextResponse.json({ error: 'LinkedIn post not found.', code: 'LINKEDIN_NOT_FOUND' }, { status: 404 });
        }
        if (err.code === 'RATE_LIMITED') {
          return NextResponse.json({ error: 'LinkedIn rate limit reached. Try again shortly.', code: 'LINKEDIN_RATE_LIMIT' }, { status: 429 });
        }
        return NextResponse.json({ error: err.message, code: 'LINKEDIN_API_ERROR' }, { status: 502 });
      }
      throw err;
    }
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/engagement.POST' });
  }
}
