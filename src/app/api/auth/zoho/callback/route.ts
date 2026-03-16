import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    // Use the request's own origin so local dev redirects go back to localhost
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'https://alphaclone.tech';

    console.log(`[Zoho Callback Debug] Received State: ${stateNonce}, Code Present: ${!!code}, URL: ${appUrl}`);

    if (!code || !stateNonce) {
        console.warn(`[Zoho Callback Debug] Missing params. State: ${stateNonce}, Code: ${!!code}`);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=missing_params`);
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Verify and consume the state nonce
        console.log(`[Zoho Callback Debug] Querying oauth_states for ID: ${stateNonce}`);
        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('user_id')
            .maybeSingle();

        if (stateError) {
            console.error(`[Zoho Callback Debug] State Query Error. Received: "${stateNonce}". DB Error:`, stateError.message);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=db_error`);
        }

        if (!stateData) {
            console.error(`[Zoho Callback Debug] State Verification Failed. Received: "${stateNonce}". Reason: State not found or expired.`);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=invalid_state`);
        }

        console.log(`[Zoho Callback Debug] State Verified. Associated User: ${stateData.user_id}`);
        const userId = stateData.user_id;

        // 2. Exchange authorization code for tokens
        const clientId = ENV.ZOHO_CLIENT_ID;
        const clientSecret = ENV.ZOHO_CLIENT_SECRET;

        // Detect Zoho DC (Data Center) from accounts-server if available, or default to .com
        const accountsServer = searchParams.get('accounts-server') || 'https://accounts.zoho.com';
        const tokenEndpoint = `${accountsServer}/oauth/v2/token`;

        const redirectUri = `${appUrl}/api/auth/zoho/callback`;

        console.log(`[Zoho Callback] Exchanging code for tokens at: ${tokenEndpoint}`);
        console.log(`[Zoho Callback] Using Redirect URI: ${redirectUri}`);

        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('[Zoho Token Error]', tokens);
            throw new Error(tokens.error_description || tokens.error || 'Failed to exchange token');
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

        // 3. Fetch Zoho Account ID (required for Mail API)
        // Adjust Mail API endpoint based on accounts-server region
        let mailApiHost = 'mail.zoho.com';
        if (accountsServer.includes('.eu')) mailApiHost = 'mail.zoho.eu';
        else if (accountsServer.includes('.in')) mailApiHost = 'mail.zoho.in';
        else if (accountsServer.includes('.com.au')) mailApiHost = 'mail.zoho.com.au';
        else if (accountsServer.includes('.jp')) mailApiHost = 'mail.zoho.jp';
        else if (accountsServer.includes('.ca')) mailApiHost = 'mail.zoho.ca';

        console.log(`[Zoho Callback] Fetching account data from: https://${mailApiHost}/api/accounts`);

        const accountResponse = await fetch(`https://${mailApiHost}/api/accounts`, {
            headers: {
                Authorization: `Zoho-oauthtoken ${access_token}`
            }
        });

        const accountData = await accountResponse.json();
        if (!accountData.data || accountData.data.length === 0) {
            throw new Error('No Zoho Mail account found');
        }

        const primaryAccount = accountData.data[0];
        const accountId = primaryAccount.accountId;
        const email = primaryAccount.emailAddress;

        // 4. Save to integrations table
        // First get existing integration to preserve refresh_token if new one is not provided
        const { data: existingIntegration } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();

        const finalRefreshToken = refresh_token || (existingIntegration?.config?.refreshToken);

        const { error: integrationError } = await supabaseAdmin
            .from('integrations')
            .upsert({
                user_id: userId,
                type: 'zoho',
                name: 'Zoho Mail',
                enabled: true,
                config: {
                    accountId,
                    accessToken: access_token,
                    refreshToken: finalRefreshToken,
                    expiryDate: expiresAt,
                    email,
                    accountsServer,
                    mailApiHost
                }
            }, {
                onConflict: 'user_id,type'
            });

        if (integrationError) throw integrationError;

        return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=connected`);
    } catch (err: any) {
        console.error('Zoho Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=${encodeURIComponent(err.message)}`);
    }
}
