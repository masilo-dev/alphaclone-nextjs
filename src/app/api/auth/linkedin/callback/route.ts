import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';
import { parseLinkedInOAuthState, type LinkedInOAuthState } from '@/lib/linkedin/oauthState';
import {
  fetchLinkedInCompanyPages,
  normalizeLinkedInScopes,
  upsertLinkedInIntegration,
} from '@/services/linkedin/linkedinIntegrationService';

const ALLOWED_LINKEDIN_RETURN = [
  '/dashboard/business/linkedin',
  '/dashboard/business/social',
  '/dashboard/business/settings',
] as const;

const LINKEDIN_REQUIRED_SCOPES = ['w_member_social', 'w_organization_social'] as const;

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
  const appUrl = (ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');

  if (oauthError) {
    return buildRedirect(appUrl, null, { ok: false, errorCode: oauthError });
  }
  if (!code || !state) {
    return buildRedirect(appUrl, null, { ok: false, errorCode: 'missing_params' });
  }

  const stateData = parseLinkedInOAuthState(state);
  if (!stateData) {
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
      console.error('[linkedin/callback] token exchange failed:', tokenRes.status, tokenData?.error);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'token_exchange_failed' });
    }

    const accessToken = String(tokenData.access_token);
    const scopeCandidates = [
      tokenData.scope,
      tokenData.scopes,
      tokenData.granted_scopes,
      tokenData.grantedScopes,
    ];
    const scopes = Array.from(new Set(scopeCandidates.flatMap((raw) => normalizeLinkedInScopes(raw))));
    const hasMemberWriteScope = scopes.includes('w_member_social');
    const hasOrgWriteScope = scopes.includes('w_organization_social');
    const hasWriteScope = hasMemberWriteScope || hasOrgWriteScope;
    const missingScopes = LINKEDIN_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));

    const profileRes = await linkedInFetch(
      'https://api.linkedin.com/v2/userinfo',
      accessToken,
      { method: 'GET' },
      { restli: false, retries: 1 }
    );
    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData?.sub) {
      console.error('[linkedin/callback] userinfo failed:', profileRes.status);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'profile_failed' });
    }

    const memberId = String(profileData.sub);
    const personUrn = `urn:li:person:${memberId}`;
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;
    const companyPages = await fetchLinkedInCompanyPages(accessToken);

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

    const upsertResult = await upsertLinkedInIntegration({
      tenantId: resolvedTenantId,
      userId: stateData.userId,
      linkedinMemberId: memberId,
      linkedinPersonUrn: personUrn,
      accessToken,
      tokenExpiresAt,
      scopes,
      isActive: hasWriteScope,
      metadata: {
        provider: 'linkedin_oauth_connector',
        name: profileData.name || null,
        email: profileData.email || null,
        picture: profileData.picture || null,
        headline: profileData.locale || null,
        public_profile_url: profileData.profile
          ? String(profileData.profile)
          : companyPages[0]?.vanityName
            ? `https://www.linkedin.com/company/${companyPages[0].vanityName}`
            : null,
        company_pages: companyPages,
        company_pages_count: companyPages.length,
        write_scope_granted: hasWriteScope,
        missing_required_scopes: missingScopes,
      },
    });
    if (upsertResult.error || !upsertResult.integrationId) {
      console.error('[linkedin/callback] integration upsert failed:', upsertResult.error);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'save_failed' });
    }

    if (!hasMemberWriteScope && !hasOrgWriteScope) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'missing_write_permissions' });
    }

    await admin.from('tenant_integrations').upsert(
      {
        tenant_id: resolvedTenantId,
        integration_id: 'linkedin-social',
        status: 'connected',
        connected_at: new Date().toISOString(),
        configured_by: stateData.userId,
        metadata: { member_id: memberId, company_pages_count: companyPages.length },
      },
      { onConflict: 'tenant_id,integration_id' }
    );

    return buildRedirect(appUrl, stateData, { ok: true });
  } catch (err) {
    console.error('[linkedin/callback] GET error:', err);
    return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'unexpected_error' });
  }
}
