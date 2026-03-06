import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    // Use the request's own origin so local dev redirects go back to localhost
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'https://alphaclone.tech';


    if (!code || !stateNonce) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=missing_params`);
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Verify and consume the state nonce
        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('user_id')
            .single();

        if (stateError || !stateData) {
            return NextResponse.redirect(`${appUrl}/dashboard/settings?zoho=error&reason=invalid_state`);
        }

        const userId = stateData.user_id;

        // 2. Exchange authorization code for tokens
        const clientId = ENV.ZOHO_CLIENT_ID;
        const clientSecret = ENV.ZOHO_CLIENT_SECRET;
        const redirectUri = `${appUrl}/api/auth/zoho/callback`;

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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
            throw new Error(tokens.error_description || 'Failed to exchange token');
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

        // 3. Fetch Zoho Account ID (required for Mail API)
        const accountResponse = await fetch('https://mail.zoho.com/api/accounts', {
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
                    refreshToken: refresh_token,
                    expiryDate: expiresAt,
                    email
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
