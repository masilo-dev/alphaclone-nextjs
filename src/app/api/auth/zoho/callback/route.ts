import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateStr = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host')}`;
        return NextResponse.redirect(`${appUrl}/dashboard/settings?section=booking&error=${error}`);
    }

    if (!code || !stateStr) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    try {
        const { region, state } = JSON.parse(stateStr);
        const hosts = ZohoService.getHostsByRegion(region);
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host')}`;
        const redirectUri = process.env.ZOHO_REDIRECT_URI || `${appUrl}/api/auth/zoho/callback`;

        // Exchange code for tokens
        const response = await fetch(`${hosts.accounts}/oauth/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.ZOHO_CLIENT_ID || '',
                client_secret: process.env.ZOHO_CLIENT_SECRET || '',
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });

        const data = await response.json();
        
        if (!data.access_token || !data.refresh_token) {
            throw new Error(data.error || 'Failed to exchange tokens');
        }

        // Get User ID from state (you should verify this in production with a nonce)
        const userId = state; // Assuming state is the user ID passed from connect
        
        // Initialize ZohoService to save config
        const zohoService = new ZohoService(userId);
        
        // Also fetch Zoho Mail account ID while we have the fresh token
        const mailAccountRes = await fetch(`https://${hosts.mail}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${data.access_token}` }
        });
        const mailAccountData = await mailAccountRes.json();
        const accountId = mailAccountData.data?.[0]?.accountId;

        await zohoService.saveConfig({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiryDate: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
            mailApiHost: hosts.mail,
            crmApiHost: hosts.crm,
            accountsServer: hosts.accounts,
            accountId: accountId
        });

        return NextResponse.redirect(`${appUrl}/dashboard/settings?section=booking&success=zoho_connected`);
    } catch (err: any) {
        console.error('Zoho Auth Callback Error:', err);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host')}`;
        return NextResponse.redirect(`${appUrl}/dashboard/settings?section=booking&error=${encodeURIComponent(err.message)}`);
    }
}
