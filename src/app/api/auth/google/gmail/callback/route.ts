import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '../../../../../../config/env';
import { createAdminClient } from '../../../../../../lib/supabaseServer';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';

    if (!code || !userId) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?gmail=error`);
    }

    try {
        const clientId = ENV.GOOGLE_CLIENT_ID;
        const clientSecret = ENV.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${appUrl}/api/auth/google/gmail/callback`;

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('Token Exchange Error:', tokens.error);
            throw new Error(tokens.error_description || 'Failed to exchange token');
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        const supabaseAdmin = createAdminClient();

        const { error } = await supabaseAdmin
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

        if (error) throw error;

        return NextResponse.redirect(`${appUrl}/dashboard/settings?gmail=connected`);
    } catch (err) {
        console.error('Gmail Callback Error:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?gmail=error`);
    }
}
