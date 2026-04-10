import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    // Use standardized appUrl
    const appUrl = (ENV.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'https://alphaclone.tech').replace(/\/$/, '');

    if (!code || !stateNonce) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=error&reason=missing_params`);
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Verify and consume the state nonce and get the code_verifier
        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('*')
            .single();

        if (stateError || !stateData) {
            console.error('[HubSpot Callback] Invalid state:', stateNonce);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=error&reason=invalid_state`);
        }

        const userId = stateData.user_id;
        const codeVerifier = stateData.metadata?.code_verifier;

        if (!codeVerifier) {
            throw new Error('Code verifier not found in state data');
        }

        // 2. Exchange authorization code for tokens
        const clientId = ENV.HUBSPOT_CLIENT_ID;
        const clientSecret = ENV.HUBSPOT_CLIENT_SECRET;
        const redirectUri = ENV.HUBSPOT_REDIRECT_URI;
        const tokenEndpoint = 'https://api.hubapi.com/oauth/v1/token';

        console.log(`[HubSpot Callback] Exchanging code for tokens at: ${tokenEndpoint}`);

        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri!,
                code_verifier: codeVerifier
            }),
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('[HubSpot Token Error]', tokens);
            throw new Error(tokens.message || tokens.error_description || 'Failed to exchange token');
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + (expires_in || 1800) * 1000).toISOString();

        // 3. Save to integrations table
        const { error: integrationError } = await supabaseAdmin
            .from('integrations')
            .upsert({
                user_id: userId,
                type: 'hubspot',
                name: 'HubSpot',
                enabled: true,
                config: {
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiryDate: expiresAt,
                    lastSync: new Date().toISOString()
                }
            }, {
                onConflict: 'user_id,type'
            });

        if (integrationError) throw integrationError;

        return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=connected`);
    } catch (err: any) {
        console.error('HubSpot Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=error&reason=${encodeURIComponent(err.message)}`);
    }
}
