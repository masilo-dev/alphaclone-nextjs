import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

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

function isLikelyPermissionError(payload: Record<string, unknown>) {
  const message = String(payload?.message || payload?.error_description || payload?.serviceErrorCode || '');
  return (
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('scope') ||
    message.toLowerCase().includes('access denied') ||
    message.toLowerCase().includes('not enough')
  );
}

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

    const res = await fetch(`https://api.linkedin.com/v2/reactions?actor=${encodeURIComponent(li.linkedin_person_urn)}&q=entity`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${li.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        root: postUrn,
        reactionType,
      }),
    });

    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || isLikelyPermissionError(parsed)) {
        return NextResponse.json({
          success: true,
          warning: 'LinkedIn reaction permission is unavailable for this connection. Reconnect and approve all requested LinkedIn permissions.',
        });
      }
      return NextResponse.json({ error: raw || `LinkedIn API error (${res.status})` }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/reaction.POST' });
  }
}
