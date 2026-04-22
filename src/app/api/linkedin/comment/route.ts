import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';

function normalizeScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
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
      parentCommentUrn?: string;
      text?: string;
      linkedinMemberId?: string;
    };

    const tenantId = body.tenantId?.trim();
    const postUrn = body.postUrn?.trim();
    const parentCommentUrn = body.parentCommentUrn?.trim();
    const text = body.text?.trim();
    const linkedinMemberId = body.linkedinMemberId?.trim();

    if (!tenantId || !postUrn || !text) {
      return NextResponse.json({ error: 'tenantId, postUrn, and text are required' }, { status: 400 });
    }

    const isMember = await ensureTenantMembership(user.id, tenantId);
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('linkedin_integrations')
      .select('linkedin_member_id, access_token, linkedin_person_urn, scopes')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);
    if (linkedinMemberId) query = query.eq('linkedin_member_id', linkedinMemberId);
    const { data: li, error: liError } = await query.maybeSingle();

    if (liError || !li?.access_token || !li?.linkedin_person_urn) {
      return NextResponse.json({ error: 'LinkedIn is not connected for this workspace.' }, { status: 400 });
    }

    const scopes = normalizeScopes(li.scopes);
    if (!scopes.includes('w_member_social')) {
      return NextResponse.json({ error: 'Missing LinkedIn scope: w_member_social' }, { status: 400 });
    }

    const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${li.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        actor: li.linkedin_person_urn,
        object: postUrn,
        parentComment: parentCommentUrn || undefined,
        message: { text },
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: raw || `LinkedIn API error (${res.status})` }, { status: 400 });
    }

    const commentUrn = res.headers.get('x-restli-id') || res.headers.get('location') || undefined;
    await captureUnifiedMessageFromWebhook({
      supabase: admin as any,
      tenantId,
      source: 'linkedin',
      channel: 'chat',
      direction: 'outbound',
      externalId: commentUrn ?? null,
      threadId: postUrn,
      from: li.linkedin_person_urn,
      to: postUrn,
      subject: null,
      text,
      html: null,
      sentAt: new Date().toISOString(),
      metadata: {
        postUrn,
        parentCommentUrn,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/comment.POST' });
  }
}
