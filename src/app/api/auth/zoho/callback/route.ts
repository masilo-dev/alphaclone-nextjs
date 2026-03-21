import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { zohoServerService, deriveRegionalHosts } from '@/services/server/zohoServerService';

export const dynamic = 'force-dynamic';
import { encrypt } from '@/lib/encryption';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    // Use the request's own origin so local dev redirects go back to localhost
    // Priority: ENV.NEXT_PUBLIC_APP_URL > req.nextUrl.origin > Fallback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (req.nextUrl.origin !== 'null' ? req.nextUrl.origin : null) || 'https://alphaclone.tech';
    
    console.log(`[Zoho Callback Debug] Received Params - State: ${stateNonce}, Code Present: ${!!code}, App URL: ${appUrl}`);

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
            // DIAGNOSTIC: Log why it might have failed
            console.error(`[Zoho Callback Debug] State Verification Failed for "${stateNonce}". Reason: State not found in 'oauth_states' table.`);
            
            // Helpful hint for user: If multiple logins were attempted, the state might be from an old session.
            return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=invalid_state_check_logs`);
        }

        console.log(`[Zoho Callback Debug] State found. Created at: ${stateData.created_at}. User: ${stateData.user_id}`);
        const userId = stateData.user_id;
        const metadata = stateData.metadata as { region?: string } | null;
        const region = metadata?.region || 'com';

        // 2. Exchange authorization code for tokens
        const clientId = ENV.ZOHO_CLIENT_ID;
        const clientSecret = ENV.ZOHO_CLIENT_SECRET;

        // Determine accounts server base on region
        const { accountsServer } = deriveRegionalHosts(region);
        
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
        
        const tokenRawText = await tokenResponse.text();
        let tokens: any;
        try {
            tokens = JSON.parse(tokenRawText);
        } catch (e) {
            console.error('[Zoho Callback Debug] Failed to parse tokens as JSON. Raw body:', tokenRawText.substring(0, 500));
            throw new Error(`Invalid response from Zoho Token endpoint. Status: ${tokenResponse.status}`);
        }

        if (tokens.error) {
            console.error('[Zoho Callback Debug] Token Exchange Failed:', tokens);
            throw new Error(tokens.error_description || tokens.error || 'Failed to exchange token');
        }

        console.log(`[Zoho Callback Debug] Token Exchange Successful. Access Token Present: ${!!tokens.access_token}, Refresh Token Present: ${!!tokens.refresh_token}`);
        
        const { access_token, refresh_token, expires_in, api_domain } = tokens;
        const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

        // 3. Resolve Mail API Host
        // CRITICAL: We prioritize api_domain from Zoho if present, 
        // otherwise fallback to our regional derivation.
        let mailApiHost = deriveRegionalHosts(region).mailApiHost;
        
        if (api_domain) {
            // api_domain usually looks like "https://mail.zoho.com" or "mail.zoho.com"
            try {
                mailApiHost = api_domain.includes('://') ? new URL(api_domain).host : api_domain;
                console.log(`[Zoho Callback] Using api_domain from Zoho: ${mailApiHost}`);
            } catch (e) {
                console.warn(`[Zoho Callback] Failed to parse api_domain "${api_domain}", falling back to derived host.`);
            }
        }
        
        console.log(`[Zoho Callback Debug] Resolved mailApiHost: ${mailApiHost} (from accountsServer: ${accountsServer}, api_domain: ${api_domain})`);

        console.log(`[Zoho Callback Debug] Fetching account data from: https://${mailApiHost}/api/accounts`);

        const accountResponse = await fetch(`https://${mailApiHost}/api/accounts`, {
            headers: { Authorization: `Zoho-oauthtoken ${access_token}` }
        });
 
        const accountRawText = await accountResponse.text();
        let accountData: any;
        try {
            accountData = JSON.parse(accountRawText);
        } catch (e) {
            console.error('[Zoho Callback Debug] Failed to parse account data as JSON. Raw body:', accountRawText.substring(0, 500));
            throw new Error(`Invalid response from Zoho Accounts endpoint. Status: ${accountResponse.status}`);
        }
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

        const secret = ENV.ENCRYPTION_SECRET;
        let encryptedAccessToken = access_token;
        let encryptedRefreshToken = finalRefreshToken;

        if (secret) {
            encryptedAccessToken = encrypt(access_token, secret);
            if (finalRefreshToken) {
                encryptedRefreshToken = encrypt(finalRefreshToken, secret);
            }
        }

        const integrationPayload = {
            user_id: userId,
            type: 'zoho',
            name: 'Zoho Mail',
            enabled: true,
            config: {
                accountId,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                expiryDate: expiresAt,
                email,
                accountsServer,
                mailApiHost,
                apiDomain: api_domain,
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
