import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ENV } from '@/config/env';

function getAppUrl(req: NextRequest) {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return host ? `${proto}://${host}` : 'https://alphaclonesystems.com';
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateStr = searchParams.get('state');
    const error = searchParams.get('error');
    const appUrl = getAppUrl(req);

    if (error) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?section=booking&error=${error}`);
    }

    if (!code || !stateStr) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    try {
        let region = 'US';
        let userId = '';
        try {
            const parsedState = JSON.parse(stateStr);
            region = typeof parsedState?.region === 'string' && parsedState.region ? parsedState.region : 'US';
            userId = typeof parsedState?.state === 'string' ? parsedState.state : '';
        } catch {
            // Backward compatibility: some legacy flows store only userId in state.
            userId = stateStr;
        }
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid OAuth state payload');
        }

        const hosts = ZohoService.getHostsByRegion(region);
        const redirectUri = ENV.ZOHO_REDIRECT_URI || `${appUrl}/api/auth/zoho/callback`;

        // Exchange code for tokens
        const response = await fetch(`${hosts.accounts}/oauth/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: ENV.ZOHO_CLIENT_ID || '',
                client_secret: ENV.ZOHO_CLIENT_SECRET || '',
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.access_token) {
            throw new Error(data.error_description || data.error || 'Failed to exchange tokens');
        }

        // Initialize ZohoService to read/save config
        const zohoService = new ZohoService(userId);
        const existingConfig = await zohoService.getConfig();
        const refreshToken = data.refresh_token || existingConfig?.refreshToken;
        if (!refreshToken) {
            throw new Error('Missing refresh token from Zoho response');
        }
        
        // Also fetch Zoho Mail account ID while we have the fresh token
        const mailHost = ZohoService.normalizeHost(hosts.mail) || hosts.mail;
        const mailAccountRes = await fetch(`https://${mailHost}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${data.access_token}` }
        });
        const mailAccountData = await mailAccountRes.json();
        const accountId = mailAccountData?.data?.[0]?.accountId ? String(mailAccountData.data[0].accountId) : undefined;

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
            accountsServer: hosts.accounts,
            accountId: accountId,
            ...(booksOrgId ? { booksOrgId } : {}),
        });

        return NextResponse.redirect(`${appUrl}/dashboard/settings?section=booking&success=zoho_connected`);
    } catch (err: unknown) {
        console.error('Zoho Auth Callback Error:', err);
        const reason = err instanceof Error ? err.message : 'zoho_callback_failed';
        return NextResponse.redirect(
            `${appUrl}/dashboard/settings?section=booking&error=zoho_callback_failed&reason=${encodeURIComponent(reason)}`
        );
    }
}
