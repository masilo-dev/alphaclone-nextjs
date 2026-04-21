import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

const ALLOWED_LINKEDIN_RETURN = [
  '/dashboard/business/linkedin',
  '/dashboard/business/social',
  '/dashboard/business/settings',
] as const;

type LinkedInOAuthState = {
  userId: string;
  tenantId?: string | null;
  returnTo?: string | null;
  ts: number;
};

const LINKEDIN_REQUIRED_SCOPES = [
  'r_verify',
  'openid',
  'profile',
  'w_member_social',
  'w_organization_social',
  'r_organization_admin',
  'r_organization_social',
  'email',
  'r_profile_basicinfo',
] as const;

export async function GET(req: NextRequest) {
  try {
    const appUrl = (ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech').replace(/\/$/, '');
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(`${appUrl}/auth/login?next=${next}`);
    }

    const tenantIdParam = req.nextUrl.searchParams.get('tenant_id')?.trim() || null;
    if (tenantIdParam) {
      const { data: member, error: memErr } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantIdParam)
        .maybeSingle();
      if (memErr || !member) {
        return NextResponse.json({ error: 'You are not a member of this workspace.' }, { status: 403 });
      }
    }

    const clientId = ENV.LINKEDIN_CLIENT_ID;
    const redirectUri = ENV.LINKEDIN_REDIRECT_URI || `${appUrl}/api/auth/linkedin/callback`;
    if (!clientId) {
      return NextResponse.redirect(`${appUrl}/dashboard/business/linkedin?li_error=app_not_configured`);
    }

    const returnToRaw = req.nextUrl.searchParams.get('return_to')?.trim();
    let returnTo: string | null = null;
    if (returnToRaw) {
      const pathOnly = returnToRaw.split('?')[0];
      if ((ALLOWED_LINKEDIN_RETURN as readonly string[]).includes(pathOnly)) {
        returnTo = pathOnly;
      }
    }

    const statePayload: LinkedInOAuthState = {
      userId: user.id,
      tenantId: tenantIdParam,
      returnTo,
      ts: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

    const forceReauth = req.nextUrl.searchParams.get('force_reauth') === '1';

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', LINKEDIN_REQUIRED_SCOPES.join(' '));
    authUrl.searchParams.set('prompt', 'consent');
    if (forceReauth) {
      // Ask LinkedIn to avoid silent reuse where possible.
      authUrl.searchParams.set('force_login', 'true');
    }
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('[linkedin/connect] GET error:', err);
    return NextResponse.json({ error: 'OAuth initialization failed' }, { status: 500 });
  }
}
