import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { linkedInFetch, LinkedInApiError } from '@/lib/linkedin/linkedinClient';
import {
  getLinkedInIntegrationWithToken,
  markLinkedInIntegrationInactive,
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

type LinkedInComment = {
  commentUrn: string;
  text: string;
  actor: string;
  createdAt: number | null;
};

function isLikelyPermissionError(payload: Record<string, unknown>) {
  const message = String(payload?.message || payload?.error_description || '');
  return (
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('scope') ||
    message.toLowerCase().includes('not enough permissions') ||
    message.toLowerCase().includes('access denied')
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

    const tenantId = body.tenantId?.trim();
    const postUrn = body.postUrn?.trim();
    const linkedinMemberId = body.linkedinMemberId?.trim();

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
      return NextResponse.json({ error: 'LinkedIn is not connected for this workspace.' }, { status: 400 });
    }

    const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=50`;
<<<<<<< HEAD
    try {
      const res = await linkedInFetch(url, integration.accessToken, { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      const comments: LinkedInComment[] = elements.map((element: Record<string, unknown>) => ({
        commentUrn: String(element?.id || element?.urn || ''),
        text: String((element?.message as Record<string, unknown> | undefined)?.text || ''),
        actor: String(element?.actor || ''),
        createdAt: typeof (element?.created as Record<string, unknown> | undefined)?.time === 'number'
          ? ((element?.created as Record<string, unknown>).time as number)
          : null,
      }));

      return NextResponse.json({ success: true, comments });
    } catch (err) {
      if (err instanceof LinkedInApiError) {
        if (err.code === 'TOKEN_EXPIRED') {
          await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired_on_comments');
          return NextResponse.json({ error: 'LinkedIn token expired. Reconnect your account.' }, { status: 401 });
        }
        if (err.code === 'FORBIDDEN') {
          return NextResponse.json({
            success: true,
            comments: [],
            warning: 'LinkedIn comment read permission is unavailable for this connection. Reconnect and approve all requested LinkedIn permissions.',
          });
        }
        if (err.code === 'RATE_LIMITED') {
          return NextResponse.json({ error: 'LinkedIn rate limit reached. Try again shortly.' }, { status: 429 });
        }
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
=======
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${li.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || isLikelyPermissionError(data as Record<string, unknown>)) {
        return NextResponse.json({
          success: true,
          comments: [],
          warning: 'LinkedIn comment read permission is unavailable for this connection. Reconnect and approve all requested LinkedIn permissions.',
        });
      }
      const errorText = typeof data?.message === 'string' ? data.message : `LinkedIn API error (${res.status})`;
      return NextResponse.json({ error: errorText }, { status: 502 });
>>>>>>> origin/main
    }
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/comments.POST' });
  }
}
