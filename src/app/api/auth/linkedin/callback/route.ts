import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
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

function buildRedirect(appUrl: string, stateData: LinkedInOAuthState | null, result: { ok: true } | { ok: false; errorCode: string }) {
  const path =
    stateData?.returnTo &&
    (ALLOWED_LINKEDIN_RETURN as readonly string[]).includes(stateData.returnTo)
      ? stateData.returnTo
      : '/dashboard/business/linkedin';
  const url = new URL(path, appUrl);
  if (result.ok) {
    url.searchParams.set('li_connected', 'true');
  } else {
    url.searchParams.set('li_error', result.errorCode);
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  const appUrl = (ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech').replace(/\/$/, '');

  if (oauthError) {
    return buildRedirect(appUrl, null, { ok: false, errorCode: oauthError });
  }
  if (!code || !state) {
    return buildRedirect(appUrl, null, { ok: false, errorCode: 'missing_params' });
  }

  let stateData: LinkedInOAuthState;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return buildRedirect(appUrl, null, { ok: false, errorCode: 'invalid_state' });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || user.id !== stateData.userId) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'unauthorized_state' });
    }

    const clientId = ENV.LINKEDIN_CLIENT_ID;
    const clientSecret = ENV.LINKEDIN_CLIENT_SECRET;
    const redirectUri = ENV.LINKEDIN_REDIRECT_URI || `${appUrl}/api/auth/linkedin/callback`;
    if (!clientId || !clientSecret) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'app_not_configured' });
    }

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData?.access_token) {
      console.error('[linkedin/callback] token exchange failed:', tokenData);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'token_exchange_failed' });
    }

    const accessToken = String(tokenData.access_token);
    const scopeRaw = typeof tokenData.scope === 'string' ? tokenData.scope : '';
    const scopes = scopeRaw.split(' ').map((s: string) => s.trim()).filter(Boolean);

    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData?.sub) {
      console.error('[linkedin/callback] userinfo failed:', profileData);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'profile_failed' });
    }

    const memberId = String(profileData.sub);
    const personUrn = `urn:li:person:${memberId}`;
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const admin = createSupabaseAdminClient();

    let resolvedTenantId: string | null = stateData.tenantId?.trim() || null;
    if (resolvedTenantId) {
      const { data: mem } = await admin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', stateData.userId)
        .eq('tenant_id', resolvedTenantId)
        .maybeSingle();
      if (!mem?.tenant_id) resolvedTenantId = null;
    }
    if (!resolvedTenantId) {
      const { data: first } = await admin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', stateData.userId)
        .limit(1)
        .maybeSingle();
      resolvedTenantId = first?.tenant_id ?? null;
    }
    if (!resolvedTenantId) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'tenant_not_found' });
    }

    const { error: upsertError } = await admin.from('linkedin_integrations').upsert(
      {
        tenant_id: resolvedTenantId,
        user_id: stateData.userId,
        linkedin_member_id: memberId,
        linkedin_person_urn: personUrn,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        scopes,
        is_active: true,
        metadata: {
          provider: 'linkedin_oauth_connector',
          name: profileData.name || null,
          email: profileData.email || null,
          picture: profileData.picture || null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_id,linkedin_member_id' }
    );
    if (upsertError) {
      console.error('[linkedin/callback] integration upsert failed:', upsertError);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'save_failed' });
    }

    await admin.from('tenant_integrations').upsert(
      {
        tenant_id: resolvedTenantId,
        integration_id: 'linkedin-social',
        status: 'connected',
        connected_at: new Date().toISOString(),
        configured_by: stateData.userId,
        metadata: { member_id: memberId },
      },
      { onConflict: 'tenant_id,integration_id' }
    );

    return buildRedirect(appUrl, stateData, { ok: true });
  } catch (err) {
    console.error('[linkedin/callback] GET error:', err);
    return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'unexpected_error' });
  }
}
