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
      text?: string;
      linkedinMemberId?: string;
    };

    const tenantId = body.tenantId?.trim();
    const postUrn = body.postUrn?.trim();
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

    const scopes = Array.isArray(li.scopes) ? li.scopes : [];
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
        message: { text },
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: raw || `LinkedIn API error (${res.status})` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'linkedin/comment.POST' });
  }
}
