import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { linkedInFetch, LinkedInApiError } from '@/lib/linkedin/linkedinClient';
import {
  getLinkedInIntegrationWithToken,
  markLinkedInIntegrationInactive,
  normalizeLinkedInScopes,
} from '@/services/linkedin/linkedinIntegrationService';

const ALLOWED_REACTIONS = new Set([
  'LIKE',
  'PRAISE',
  'MAYBE',
  'EMPATHY',
  'INTEREST',
  'APPRECIATION',
]);

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
      reactionType?: string;
      linkedinMemberId?: string;
    };

    const tenantId = body.tenantId?.trim();
    const postUrn = body.postUrn?.trim();
    const reactionType = body.reactionType?.trim().toUpperCase() || 'LIKE';
    const linkedinMemberId = body.linkedinMemberId?.trim();

    if (!tenantId || !postUrn) {
      return NextResponse.json({ error: 'tenantId and postUrn are required' }, { status: 400 });
    }
    if (!ALLOWED_REACTIONS.has(reactionType)) {
      return NextResponse.json({ error: 'Unsupported reaction type' }, { status: 400 });
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
      await linkedInFetch(
        `https://api.linkedin.com/v2/reactions?actor=${encodeURIComponent(integration.linkedin_person_urn)}&q=entity`,
        integration.accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ root: postUrn, reactionType }),
        }
      );
      return NextResponse.json({ success: true });
    } catch (err) {
      if (err instanceof LinkedInApiError) {
        if (err.code === 'TOKEN_EXPIRED') {
          await markLinkedInIntegrationInactive(admin, integration.id, 'token_expired_on_reaction');
          return NextResponse.json({ error: 'LinkedIn token expired. Reconnect your account.' }, { status: 401 });
        }
        if (err.code === 'FORBIDDEN') {
          return NextResponse.json({
            success: true,
            warning: 'LinkedIn reaction permission is unavailable for this connection. Reconnect and approve all requested LinkedIn permissions.',
          });
        }
        if (err.code === 'RATE_LIMITED') {
          return NextResponse.json({ error: 'LinkedIn rate limit reached.' }, { status: 429 });
        }
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
    }
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/reaction.POST' });
  }
}
