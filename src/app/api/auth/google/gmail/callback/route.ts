import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../../lib/supabase';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // We passed userId in 'state'

    if (!code || !userId) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?gmail=error`);
    }

    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/gmail/callback`;

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
            console.error('Token Exchange Error:', tokens.error);
            throw new Error(tokens.error_description || 'Failed to exchange token');
        }

        const { access_token, refresh_token, expires_in } = tokens;
        const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        // Use service role key to upsert if necessary, or regular supabase client if RLS allows
        // Note: The schema has RLS. We can use the service role client for auth callbacks if needed.
        // However, since we have the userId and the user is ideally authenticated, 
        // a regular client might work if we have the session. 
        // For API routes, it's safer to use the service role client to ensure token persistence.

        const { error } = await supabase
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

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?gmail=connected`);
    } catch (err) {
        console.error('Gmail Callback Error:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?gmail=error`);
    }
}
