import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ENV } from '@/config/env';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function getAppUrl(req: NextRequest) {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return host ? `${proto}://${host}` : 'https://alphaclonesystems.com';
}

function getZohoRedirectUri(req: NextRequest) {
    const appUrl = getAppUrl(req).replace(/\/$/, '');
    const configured = String(ENV.ZOHO_REDIRECT_URI || '').trim();
    if (configured) return configured.replace(/\/$/, '');
    return `${appUrl}/api/auth/zoho/callback`;
}

function resolveZohoCredentials(region: string): { clientId: string; clientSecret: string } {
    const normalizedRegion = (region || 'US').toUpperCase();
    const regionClientId = (ENV as Record<string, unknown>)[`ZOHO_CLIENT_ID_${normalizedRegion}`];
    const regionClientSecret = (ENV as Record<string, unknown>)[`ZOHO_CLIENT_SECRET_${normalizedRegion}`];
    const clientId = String(regionClientId || ENV.ZOHO_CLIENT_ID || '').trim();
    const clientSecret = String(regionClientSecret || ENV.ZOHO_CLIENT_SECRET || '').trim();
    return { clientId, clientSecret };
}

export async function GET(req: NextRequest) {
    try {
    const { searchParams } = new URL(req.url);
    const requestedRegion = searchParams.get('region');
    const state = searchParams.get('state') || ''; // user ID or secure nonce

    const redirectUri = getZohoRedirectUri(req);

    let identityState = state;
    if (!identityState) {
        const supabase = await createSupabaseServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
            identityState = user.id;
        }
    }

    if (!identityState) {
        return NextResponse.json({ error: 'Missing user identity state' }, { status: 400 });
    }

    const region = (requestedRegion || ENV.ZOHO_REGION || 'US').toUpperCase();
    const { clientId, clientSecret } = resolveZohoCredentials(region);
    if (!clientId || !clientSecret) {
        return NextResponse.json(
            { error: `Zoho OAuth credentials are missing for region ${region}` },
            { status: 500 }
        );
    }
    const hosts = ZohoService.getHostsByRegion(region);

    const scopes = [
        // Mail
        'ZohoMail.accounts.READ',
        'ZohoMail.messages.ALL',
        'ZohoMail.folders.READ',
        // CRM
        'ZohoCRM.modules.ALL',
        'ZohoCRM.users.READ',
        // Books (finance)
        'ZohoBooks.fullaccess.all',
        // Campaigns (native marketing module)
        'ZohoCampaigns.campaign.ALL',
        'ZohoCampaigns.contact.ALL',
    ];

    const authUrl = new URL(`${hosts.accounts}/oauth/v2/auth`);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', JSON.stringify({ region, state: identityState }));

    return NextResponse.redirect(authUrl.toString());
    } catch (err) {
        console.error('[zoho/connect] GET error:', err);
        return NextResponse.json({ error: 'OAuth initialization failed' }, { status: 500 });
    }
}
