import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get('region') || 'US';
    const state = searchParams.get('state') || ''; // e.g. user ID or nonce

    const hosts = ZohoService.getHostsByRegion(region);
    const clientId = process.env.ZOHO_CLIENT_ID;
    
    // Robust redirect URI fallback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host')}`;
    const redirectUri = process.env.ZOHO_REDIRECT_URI || `${appUrl}/api/auth/zoho/callback`;

    if (!clientId) {
        return NextResponse.json({ error: 'Zoho Client ID not configured' }, { status: 500 });
    }

    const scopes = [
        'ZohoMail.accounts.READ',
        'ZohoMail.messages.ALL',
        'ZohoMail.folders.READ',
        'ZohoCRM.modules.ALL',
        'ZohoCRM.users.READ'
    ];

    const authUrl = new URL(`${hosts.accounts}/oauth/v2/auth`);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', JSON.stringify({ region, state }));

    return NextResponse.redirect(authUrl.toString());
}
