import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '../../../../../../config/env';
import { createAdminClient } from '../../../../../../lib/supabaseServer';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';

    console.log('Gmail Callback Received:', { stateNonce, hasCode: !!code });

    if (!code || !stateNonce) {
        console.error('Gmail Callback: Missing code or state');
        return NextResponse.redirect(`${appUrl}/dashboard/settings?gmail=error&reason=missing_params`);
    }

    try {
        console.log('Creating admin client for callback...');
        const supabaseAdmin = createAdminClient();

        // 1. Verify and consume the state nonce
        console.log('Verifying state nonce:', stateNonce);
        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('user_id')
            .single();

        if (stateError || !stateData) {
            console.error('Gmail Callback: Invalid or expired state', stateError);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?gmail=error&reason=invalid_state`);
        }

        const userId = stateData.user_id;
        console.log('State verified for user:', userId);

        // 2. Exchange authorization code for tokens
        const clientId = ENV.GOOGLE_CLIENT_ID;
        const clientSecret = ENV.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${appUrl}/api/auth/google/gmail/callback`;

        console.log('Exchanging auth code for tokens...');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
            console.error('Token Exchange Error:', tokens.error, tokens.error_description);
            throw new Error(tokens.error_description || 'Failed to exchange token');
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
        console.log('Tokens received, access token expires in:', expires_in);

        // 3. Upsert tokens into the database
        const { error: upsertError } = await supabaseAdmin
            .from('gmail_sync_tokens')
            .upsert({
                user_id: userId,
                access_token,
                refresh_token,
                expires_at: expiresAt,
                last_synced_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            });

        if (upsertError) {
            console.error('Supabase Upsert Error:', upsertError);
            throw upsertError;
        }

        return NextResponse.redirect(`${appUrl}/dashboard/settings?gmail=connected`);
    } catch (err) {
        console.error('Gmail Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?gmail=error`);
    }
}
