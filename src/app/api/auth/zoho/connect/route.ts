import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { ENV } from '@/config/env';
import { createSupabaseServerClient } from '@/lib/supabase-server';

function getAppUrl(req: NextRequest) {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return host ? `${proto}://${host}` : 'https://alphaclone.tech';
}

export async function GET(req: NextRequest) {
    try {
    const { searchParams } = new URL(req.url);
    const requestedRegion = searchParams.get('region');
    const state = searchParams.get('state') || ''; // user ID or secure nonce

    const clientId = ENV.ZOHO_CLIENT_ID;
    const clientSecret = ENV.ZOHO_CLIENT_SECRET;
    
    const appUrl = getAppUrl(req);
    const redirectUri = ENV.ZOHO_REDIRECT_URI || `${appUrl}/api/auth/zoho/callback`;

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Zoho OAuth is not fully configured' }, { status: 500 });
    }

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

    let region = (requestedRegion || ENV.ZOHO_REGION || 'US').toUpperCase();
    if (!requestedRegion) {
        try {
            const existing = await new ZohoService(identityState).getConfig();
            const accountsServer = (existing?.accountsServer || '').toLowerCase();
            if (accountsServer.includes('.zoho.eu')) region = 'EU';
            else if (accountsServer.includes('.zoho.in')) region = 'IN';
            else if (accountsServer.includes('.zoho.com.au')) region = 'AU';
            else if (accountsServer.includes('.zoho.jp')) region = 'JP';
            else if (accountsServer.includes('.zoho.ca')) region = 'CA';
            else if (accountsServer.includes('.zoho.com')) region = 'US';
        } catch {
            // Fall back to default region if config lookup fails.
        }
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
