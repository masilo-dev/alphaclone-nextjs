import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { captureUnifiedMessageFromWebhook } from '@/services/intelligence/signalCaptureAdminService';
<<<<<<< HEAD
import { linkedInFetch, LinkedInApiError } from '@/lib/linkedin/linkedinClient';
import {
  getLinkedInIntegrationWithToken,
  markLinkedInIntegrationInactive,
  normalizeLinkedInScopes,
} from '@/services/linkedin/linkedinIntegrationService';
=======

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
>>>>>>> origin/main

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
    const integration = await getLinkedInIntegrationWithToken(admin, {
      tenantId,
      userId: user.id,
      linkedinMemberId: linkedinMemberId || null,
    });

    if (!integration?.accessToken || !integration.linkedin_person_urn) {
      return NextResponse.json({ error: 'LinkedIn is not connected for this workspace.' }, { status: 400 });
    }

    const scopes = normalizeLinkedInScopes(integration.scopes);
    if (!scopes.includes('w_member_social')) {
      return NextResponse.json({ error: 'Missing LinkedIn scope: w_member_social' }, { status: 400 });
    }

    try {
      const res = await linkedInFetch(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`,
        integration.accessToken,
        {
          method: 'POST',
          body: JSON.stringify({
            actor: integration.linkedin_person_urn,
            object: postUrn,
            parentComment: parentCommentUrn || undefined,
            message: { text },
          }),
        }
      );

      const commentUrn = res.headers.get('x-restli-id') || res.headers.get('location') || undefined;
      await captureUnifiedMessageFromWebhook({
        supabase: admin as any,
        tenantId,
        source: 'linkedin',
        channel: 'chat',
        direction: 'outbound',
        externalId: commentUrn ?? null,
        threadId: postUrn,
        from: integration.linkedin_person_urn,
        to: postUrn,
        subject: null,
        text,
        html: null,
        sentAt: new Date().toISOString(),
        metadata: { postUrn, parentCommentUrn },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof LinkedInApiError && err.code === 'TOKEN_EXPIRED') {
        await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired_on_comment');
        return NextResponse.json({ error: 'LinkedIn token expired. Reconnect your account.' }, { status: 401 });
      }
      const message = err instanceof Error ? err.message : 'LinkedIn comment failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
<<<<<<< HEAD
=======

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
>>>>>>> origin/main
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/comment.POST' });
  }
}
