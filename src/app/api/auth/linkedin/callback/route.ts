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

<<<<<<< HEAD
const LINKEDIN_REQUIRED_SCOPES = ['w_member_social', 'w_organization_social'] as const;
const LINKEDIN_WRITE_SCOPES = ['w_member_social', 'w_organization_social'] as const;
=======
type LinkedInOAuthState = {
  userId: string;
  tenantId?: string | null;
  returnTo?: string | null;
  ts: number;
};

const LINKEDIN_REQUIRED_SCOPES = [
  // Keep activation tied to posting capability.
  'w_member_social',
  'w_organization_social',
] as const;

function normalizeScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => String(value).split(/[,\s]+/))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}
>>>>>>> origin/main

type LinkedInCompanyPage = {
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
};

async function fetchLinkedInCompanyPages(accessToken: string): Promise<LinkedInCompanyPage[]> {
  const url =
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,vanityName,logoV2(original~:playableStreams))))';
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  if (!res.ok) {
    return [];
  }

  const payload = await res.json().catch(() => ({}));
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  return elements
    .map((entry: any) => {
      const target = entry?.['organizationalTarget~'];
      const streams = target?.logoV2?.['original~']?.elements;
      const firstStream = Array.isArray(streams) ? streams[0] : null;
      const firstIdentifier = Array.isArray(firstStream?.identifiers) ? firstStream.identifiers[0] : null;
      return {
        id: target?.id ? String(target.id) : '',
        name: target?.localizedName ? String(target.localizedName) : null,
        vanityName: target?.vanityName ? String(target.vanityName) : null,
        logoUrl: firstIdentifier?.identifier ? String(firstIdentifier.identifier) : null,
      } as LinkedInCompanyPage;
    })
    .filter((page: LinkedInCompanyPage) => Boolean(page.id));
}

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
    const admin = createSupabaseAdminClient();
    const stateNonce = typeof stateData.nonce === 'string' ? stateData.nonce.trim() : '';
    if (!stateNonce) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'invalid_state' });
    }
    const { data: oauthStateRow, error: oauthStateError } = await admin
      .from('oauth_states')
      .delete()
      .eq('id', stateNonce)
      .select('user_id, metadata')
      .single();
    if (oauthStateError || !oauthStateRow?.user_id) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'invalid_state' });
    }
    if (oauthStateRow.user_id !== stateData.userId) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'unauthorized_state' });
    }
    const metadata =
      oauthStateRow.metadata && typeof oauthStateRow.metadata === 'object'
        ? (oauthStateRow.metadata as Record<string, unknown>)
        : {};
    const resolvedUserId = String(oauthStateRow.user_id);
    const stateTenantId =
      typeof metadata.tenant_id === 'string' && metadata.tenant_id.trim()
        ? metadata.tenant_id.trim()
        : stateData.tenantId?.trim() || null;
    const stateReturnTo =
      typeof metadata.return_to === 'string' && metadata.return_to.trim()
        ? metadata.return_to.trim()
        : stateData.returnTo || null;

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
<<<<<<< HEAD
    const scopes = Array.from(new Set(scopeCandidates.flatMap((raw) => normalizeLinkedInScopes(raw))));
    const hasMemberWriteScope = scopes.includes('w_member_social');
    const hasOrgWriteScope = scopes.includes('w_organization_social');
    const hasWriteScope = hasMemberWriteScope || hasOrgWriteScope;
    const missingScopes = LINKEDIN_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
    const hasAnyWriteScope = LINKEDIN_WRITE_SCOPES.some((scope) => scopes.includes(scope));
=======
    const scopes = Array.from(new Set(scopeCandidates.flatMap((raw) => normalizeScopes(raw))));
    const hasMemberWriteScope = scopes.includes('w_member_social');
    const hasOrgWriteScope = scopes.includes('w_organization_social');
    const hasWriteScope = hasMemberWriteScope || hasOrgWriteScope;
    const missingScopes = LINKEDIN_REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope.toLowerCase()));
>>>>>>> origin/main

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
<<<<<<< HEAD
    let companyPages: Awaited<ReturnType<typeof fetchLinkedInCompanyPages>>['companyPages'] = [];
    let companyPagesDiagnostics: Awaited<ReturnType<typeof fetchLinkedInCompanyPages>>['diagnostics'] | null = null;
    try {
      const fetched = await fetchLinkedInCompanyPages(accessToken, scopes);
      companyPages = fetched.companyPages;
      companyPagesDiagnostics = fetched.diagnostics;
    } catch (err) {
      console.warn('[linkedin/callback] company page fetch failed:', err);
    }
=======
    const companyPages = await fetchLinkedInCompanyPages(accessToken);
>>>>>>> origin/main

    let resolvedTenantId: string | null = stateTenantId;
    if (resolvedTenantId) {
      const { data: mem } = await admin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', resolvedUserId)
        .eq('tenant_id', resolvedTenantId)
        .maybeSingle();
      if (!mem?.tenant_id) resolvedTenantId = null;
    }
    if (!resolvedTenantId) {
      const { data: first } = await admin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', resolvedUserId)
        .limit(1)
        .maybeSingle();
      resolvedTenantId = first?.tenant_id ?? null;
    }
    if (!resolvedTenantId) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'tenant_not_found' });
    }

<<<<<<< HEAD
    const upsertResult = await upsertLinkedInIntegration({
      tenantId: resolvedTenantId,
      userId: resolvedUserId,
      linkedinMemberId: memberId,
      linkedinPersonUrn: personUrn,
      accessToken,
      tokenExpiresAt,
      scopes,
      isActive: hasAnyWriteScope,
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
        company_pages_diagnostics: companyPagesDiagnostics,
        write_scope_granted: hasAnyWriteScope,
        missing_required_scopes: missingScopes,
=======
    const { error: upsertError } = await admin.from('linkedin_integrations').upsert(
      {
        tenant_id: resolvedTenantId,
        user_id: stateData.userId,
        linkedin_member_id: memberId,
        linkedin_person_urn: personUrn,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        scopes,
        is_active: hasWriteScope,
        metadata: {
          provider: 'linkedin_oauth_connector',
          name: profileData.name || null,
          email: profileData.email || null,
          picture: profileData.picture || null,
          company_pages: companyPages,
          company_pages_count: companyPages.length,
          write_scope_granted: hasWriteScope,
          missing_required_scopes: missingScopes,
        },
        updated_at: new Date().toISOString(),
>>>>>>> origin/main
      },
    });
    if (upsertResult.error || !upsertResult.integrationId) {
      console.error('[linkedin/callback] integration upsert failed:', upsertResult.error);
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'save_failed' });
    }

<<<<<<< HEAD
    if (companyPages.length > 0) {
      const organizationRows = companyPages.map((page) => ({
        tenant_id: resolvedTenantId,
        user_id: resolvedUserId,
        type: 'organization' as const,
        linkedin_organization_id: page.id,
        author_urn: `urn:li:organization:${page.id}`,
        name: page.name,
        vanity_name: page.vanityName,
        logo_url: page.logoUrl,
        can_post: hasOrgWriteScope,
        metadata: {
          source: 'linkedin_oauth_connector',
          member_id: memberId,
          company_page: page,
          scopes,
        },
        updated_at: new Date().toISOString(),
      }));

      const { error: orgUpsertError } = await admin
        .from('linkedin_identities')
        .upsert(organizationRows, { onConflict: 'tenant_id,user_id,type,linkedin_organization_id' });
      if (orgUpsertError) {
        console.error('[linkedin/callback] organization identity upsert failed:', orgUpsertError);
        return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'save_failed' });
      }
=======
    if (!hasMemberWriteScope && !hasOrgWriteScope) {
      return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'missing_write_permissions' });
>>>>>>> origin/main
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
        configured_by: resolvedUserId,
        metadata: { member_id: memberId, company_pages_count: companyPages.length },
      },
      { onConflict: 'tenant_id,integration_id' }
    );

    return buildRedirect(appUrl, { ...stateData, tenantId: resolvedTenantId, returnTo: stateReturnTo }, { ok: true });
  } catch (err) {
    console.error('[linkedin/callback] GET error:', err);
    return buildRedirect(appUrl, stateData, { ok: false, errorCode: 'unexpected_error' });
  }
}
