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

        // 1. Verify the state nonce (Resilient to double-requests)
        console.log(`[Zoho Callback Debug] Verifying state: "${stateNonce}"`);
        
        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .select('user_id, created_at, metadata')
            .eq('id', stateNonce)
            .maybeSingle();

        if (stateError) {
            console.error(`[Zoho Callback Debug] State Query Error for "${stateNonce}":`, stateError.message);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=db_error`);
        }

        if (!stateData) {
            console.error(`[Zoho Callback Debug] State Verification Failed for "${stateNonce}". Reason: State not found in DB.`);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=invalid_state`);
        }

        console.log(`[Zoho Callback Debug] State found. Created at: ${stateData.created_at}. User: ${stateData.user_id}`);
        const userId = stateData.user_id;
        const metadata = stateData.metadata as { region?: string } | null;
        const region = metadata?.region || 'com';

        // 2. Exchange authorization code for tokens
        const clientId = ENV.ZOHO_CLIENT_ID;
        const clientSecret = ENV.ZOHO_CLIENT_SECRET;

        // Determine accounts server base on region (falling back to searchParams if Zoho provided it)
        let accountsServer = searchParams.get('accounts-server');
        if (!accountsServer) {
            accountsServer = region === 'com' ? 'https://accounts.zoho.com' : `https://accounts.zoho.${region}`;
        }
        
        const tokenEndpoint = accountsServer.endsWith('/') ? `${accountsServer}oauth/v2/token` : `${accountsServer}/oauth/v2/token`;
        const redirectUri = `${appUrl}/api/auth/zoho/callback`;

        console.log(`[Zoho Callback Debug] Exchanging code for tokens at: ${tokenEndpoint}`);
        
        const tokenParams = new URLSearchParams({
            code,
            client_id: clientId!,
            client_secret: clientSecret!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });

        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams,
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('[Zoho Callback Debug] Token Exchange Failed:', tokens);
            throw new Error(tokens.error_description || tokens.error || 'Failed to exchange token');
        }

        console.log(`[Zoho Callback Debug] Token Exchange Successful. Access Token Present: ${!!tokens.access_token}, Refresh Token Present: ${!!tokens.refresh_token}`);
        
        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

        // 3. Fetch Zoho Account ID
        let mailApiHost = 'mail.zoho.com';
        if (accountsServer.includes('.eu')) mailApiHost = 'mail.zoho.eu';
        else if (accountsServer.includes('.in')) mailApiHost = 'mail.zoho.in';
        else if (accountsServer.includes('.com.au')) mailApiHost = 'mail.zoho.com.au';
        else if (accountsServer.includes('.jp')) mailApiHost = 'mail.zoho.jp';
        else if (accountsServer.includes('.ca')) mailApiHost = 'mail.zoho.ca';

        console.log(`[Zoho Callback Debug] Fetching account data from: https://${mailApiHost}/api/accounts`);

        const accountResponse = await fetch(`https://${mailApiHost}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${access_token}` }
        });

        const accountData = await accountResponse.json();
        console.log(`[Zoho Callback Debug] Account Data Received. Success: ${!!accountData.data}`);

        if (!accountData.data || accountData.data.length === 0) {
            console.error('[Zoho Callback Debug] No Zoho Mail accounts found in response:', accountData);
            throw new Error('No Zoho Mail account found. Please ensure you have a Zoho Mail account configured.');
        }

        const primaryAccount = accountData.data[0];
        const accountId = primaryAccount.accountId;
        const email = primaryAccount.emailAddress;
        
        console.log(`[Zoho Callback Debug] Primary Account Identified: ${email} (${accountId})`);

        // 4. Save to integrations table
        console.log(`[Zoho Callback Debug] Checking for existing integration for user ${userId}`);
        const { data: existingIntegration } = await supabaseAdmin
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'zoho')
            .maybeSingle();

        const finalRefreshToken = refresh_token || (existingIntegration?.config?.refreshToken);
        
        if (!finalRefreshToken) {
            console.warn('[Zoho Callback Debug] No refresh token received and none found in existing integration. Future token refreshes will fail.');
        }

        const integrationPayload = {
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
                mailApiHost,
                region
            },
            updated_at: new Date().toISOString()
        };

        console.log(`[Zoho Callback Debug] Upserting integration for user ${userId}`);
        const { error: integrationError } = await supabaseAdmin
            .from('integrations')
            .upsert(integrationPayload, { onConflict: 'user_id,type' });

        if (integrationError) {
            console.error('[Zoho Callback Debug] Database Upsert Failed:', integrationError);
            throw integrationError;
        }

        console.log(`[Zoho Callback Debug] Integration Successful. Redirecting user ${userId} to dashboard.`);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=connected`);
    } catch (err: any) {
        console.error('[Zoho Callback Debug] Fatal Error:', err.message);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=${encodeURIComponent(err.message)}`);
    }
}
