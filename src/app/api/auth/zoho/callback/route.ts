import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

function getAppUrl(_req: NextRequest) {
    return PUBLIC_APP_ORIGIN;
}

function getZohoRedirectUri(_req: NextRequest) {
    const configured = String(ENV.ZOHO_REDIRECT_URI || '').trim();
    if (configured) return configured.replace(/\/$/, '');
    return OAUTH_CALLBACKS.zoho;
}

type ZohoTokenResponse = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
};

type ZohoMailAccountsResponse = {
    data?: Array<{ accountId?: string | number }>;
};

function resolveZohoCredentials(region: string): { clientId: string; clientSecret: string } {
    const normalizedRegion = (region || 'US').toUpperCase();
    const regionClientId = (ENV as Record<string, unknown>)[`ZOHO_CLIENT_ID_${normalizedRegion}`];
    const regionClientSecret = (ENV as Record<string, unknown>)[`ZOHO_CLIENT_SECRET_${normalizedRegion}`];
    const clientId = String(regionClientId || ENV.ZOHO_CLIENT_ID || '').trim();
    const clientSecret = String(regionClientSecret || ENV.ZOHO_CLIENT_SECRET || '').trim();
    return { clientId, clientSecret };
}

async function exchangeZohoToken(params: {
    code: string;
    redirectUri: string;
    region: string;
}): Promise<{ ok: true; data: ZohoTokenResponse; region: string } | { ok: false; error: string; region: string }> {
    const hosts = ZohoService.getHostsByRegion(params.region);
    const { clientId, clientSecret } = resolveZohoCredentials(params.region);
    if (!clientId || !clientSecret) {
        return { ok: false, error: `Missing Zoho credentials for region ${params.region}`, region: params.region };
    }
    const response = await fetch(`${hosts.accounts}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code: params.code,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            redirect_uri: params.redirectUri,
        }),
    });
    const data = (await response.json().catch(() => ({}))) as ZohoTokenResponse;
    if (!response.ok || !data.access_token) {
        const reason = data.error_description || data.error || `token_exchange_failed_${response.status}`;
        return { ok: false, error: String(reason), region: params.region };
    }
    return { ok: true, data, region: params.region };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateStr = searchParams.get('state');
    const error = searchParams.get('error');
    const appUrl = getAppUrl(req);
    const zohoMailReturnUrl = `${appUrl}/dashboard/mail`;

    if (error) {
        const description = searchParams.get('error_description');
        const redirectUrl = new URL(zohoMailReturnUrl);
        redirectUrl.searchParams.set('error', error);
        if (description) redirectUrl.searchParams.set('reason', description);
        return NextResponse.redirect(redirectUrl);
    }

    if (!code || !stateStr) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    try {
        const admin = createSupabaseAdminClient();
        const { data: stateData, error: stateError } = await admin.from('oauth_states')
            .delete().eq('id', stateStr).select('user_id, tenant_id, metadata, created_at').single();
        const stateCreatedAt = stateData?.created_at ? new Date(stateData.created_at).getTime() : 0;
        if (stateError || !stateData?.user_id || !stateData?.tenant_id || stateData.metadata?.provider !== 'zoho' || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60_000) {
            throw new Error('Invalid OAuth state payload');
        }
        const userId = String(stateData.user_id);
        const tenantId = String(stateData.tenant_id);
        const region = typeof stateData.metadata?.region === 'string' ? stateData.metadata.region : 'US';

        const redirectUri = getZohoRedirectUri(req);
        const candidateRegions = [
            region,
            String(ENV.ZOHO_REGION || '').toUpperCase(),
            'US',
            'EU',
            'IN',
            'AU',
            'JP',
            'CA',
        ].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

        let tokenResult: Awaited<ReturnType<typeof exchangeZohoToken>> | null = null;
        let lastError = 'Failed to exchange tokens';
        for (const candidateRegion of candidateRegions) {
            const attempt = await exchangeZohoToken({
                code,
                redirectUri,
                region: candidateRegion,
            });
            if (attempt.ok) {
                tokenResult = attempt;
                break;
            }
            lastError = attempt.error;
        }
        if (!tokenResult || !tokenResult.ok) {
            throw new Error(lastError);
        }
        const data = tokenResult.data;
        const resolvedRegion = tokenResult.region;
        const hosts = ZohoService.getHostsByRegion(resolvedRegion);

        // Initialize ZohoService to read/save config
        const zohoService = new ZohoService(userId, tenantId);
        const existingConfig = await zohoService.getConfig();
        const refreshToken = data.refresh_token || existingConfig?.refreshToken;
        if (!refreshToken) {
            throw new Error('Missing refresh token from Zoho response');
        }
        
        // Discover the Mail account while the access token is fresh. A Zoho
        // account can authorize the shared OAuth client without having Mail
        // provisioned, so this optional product lookup must not discard valid
        // tokens or fail the entire callback.
        const mailHost = ZohoService.normalizeHost(hosts.mail) || hosts.mail;
        let accountId: string | undefined;
        let mailSetupReason: string | undefined;
        try {
            const mailAccountRes = await fetch(`https://${mailHost}/api/accounts`, {
                headers: { Authorization: `Zoho-oauthtoken ${data.access_token}` },
            });
            const mailAccountData = (await mailAccountRes.json().catch(() => ({}))) as ZohoMailAccountsResponse;
            const discoveredAccountId = mailAccountData.data?.[0]?.accountId;
            if (mailAccountRes.ok && discoveredAccountId != null) {
                accountId = String(discoveredAccountId);
            } else {
                mailSetupReason = mailAccountRes.ok
                    ? 'No Zoho Mail account was found for this user.'
                    : `Zoho Mail account discovery returned HTTP ${mailAccountRes.status}.`;
                console.warn('[zoho/callback] Mail account discovery incomplete:', mailSetupReason);
            }
        } catch (mailError) {
            mailSetupReason = 'Zoho Mail account discovery was temporarily unavailable.';
            console.warn('[zoho/callback] Mail account discovery failed:', mailError);
        }

        // Fetch Zoho Books org ID while we have the fresh token
        let booksOrgId: string | undefined;
        try {
            const booksHost = hosts.mail.replace('mail.', 'books.');
            const booksOrgsRes = await fetch(`https://${booksHost}/api/v3/organizations`, {
                headers: { Authorization: `Zoho-oauthtoken ${data.access_token}` }
            });
            if (booksOrgsRes.ok) {
                const booksOrgsData = await booksOrgsRes.json();
                booksOrgId = booksOrgsData.organizations?.[0]?.organization_id;
            }
        } catch {
            // Books scope may not be granted — continue without it
        }

        await zohoService.saveConfig({
            accessToken: data.access_token,
            refreshToken,
            expiryDate: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
            mailApiHost: mailHost,
            crmApiHost: ZohoService.normalizeHost(hosts.crm),
            campaignsApiHost: ZohoService.normalizeHost(hosts.campaigns),
            accountsServer: hosts.accounts,
            accountId: accountId,
            ...(booksOrgId ? { booksOrgId } : {}),
        });

        const { error: connectionError } = await admin.from('tenant_integrations').upsert({
            tenant_id: tenantId,
            integration_id: 'zoho-mail',
            status: 'connected',
            connected_at: new Date().toISOString(),
            configured_by: userId,
            metadata: {
                region: resolvedRegion,
                mailReady: Boolean(accountId),
                booksReady: Boolean(booksOrgId),
                ...(mailSetupReason ? { mailSetupReason } : {}),
            },
        }, { onConflict: 'tenant_id,integration_id' });
        if (connectionError) throw connectionError;
        await admin.from('business_automation_events').insert({
            tenant_id: tenantId,
            event_type: 'integration_connected',
            payload: { integrationId: 'zoho-mail', actorUserId: userId },
        });

        const successUrl = new URL(zohoMailReturnUrl);
        successUrl.searchParams.set('success', 'zoho_connected');
        if (!accountId) successUrl.searchParams.set('mail', 'setup_required');
        return NextResponse.redirect(successUrl);
    } catch (err: unknown) {
        console.error('Zoho Auth Callback Error:', err);
        const reason = err instanceof Error ? err.message : 'zoho_callback_failed';
        return NextResponse.redirect(
            `${zohoMailReturnUrl}?error=zoho_callback_failed&reason=${encodeURIComponent(reason)}`
        );
    }
}
