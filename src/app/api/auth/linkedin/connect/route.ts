import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';
import { encodeLinkedInOAuthState, type LinkedInOAuthState } from '@/lib/linkedin/oauthState';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

const ALLOWED_LINKEDIN_RETURN = [
  '/dashboard/business/linkedin',
  '/dashboard/business/social',
  '/dashboard/business/settings',
] as const;

/** Full set of authorized LinkedIn scopes for profiles, pages, ads, lead sync, and verification */
const LINKEDIN_REQUESTED_SCOPES = [
  'openid',
  'profile',
  'email',
  'r_basicprofile',
  'r_profile_basicinfo',
  'w_member_social',
  'w_organization_social',
  'r_organization_social',
  'r_organization_admin',
  'rw_organization_admin',
  'r_ads',
  'rw_ads',
  'r_ads_reporting',
  'r_ads_leadgen_automation',
  'r_marketing_leadgen_automation',
  'r_1st_connections_size',
  'r_verify',
] as const;

export async function GET(req: NextRequest) {
  try {
    const appUrl = PUBLIC_APP_ORIGIN;
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
    const redirectUri = ENV.LINKEDIN_REDIRECT_URI || OAUTH_CALLBACKS.linkedin;
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
      nonce: crypto.randomUUID(),
      userId: user.id,
      tenantId: tenantIdParam,
      returnTo,
      ts: Date.now(),
    };
    const admin = createSupabaseAdminClient();
    const { error: stateError } = await admin.from('oauth_states').insert({
      id: statePayload.nonce,
      user_id: user.id,
      metadata: {
        provider: 'linkedin',
        tenant_id: tenantIdParam,
        return_to: returnTo,
      },
    });
    if (stateError) {
      console.error('[linkedin/connect] oauth_states insert failed:', stateError);
      return NextResponse.json({ error: 'OAuth initialization failed' }, { status: 500 });
    }
    const state = encodeLinkedInOAuthState(statePayload);

    const forceReauth = req.nextUrl.searchParams.get('force_reauth') === '1';

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', LINKEDIN_REQUESTED_SCOPES.join(' '));
    authUrl.searchParams.set('prompt', 'consent');
    if (forceReauth) {
      authUrl.searchParams.set('force_login', 'true');
    }
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('[linkedin/connect] GET error:', err);
    return NextResponse.json({ error: 'OAuth initialization failed' }, { status: 500 });
  }
}
