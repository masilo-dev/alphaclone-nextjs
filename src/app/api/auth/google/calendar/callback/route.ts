import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';

    if (!code || !stateNonce) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=error&reason=missing_params`);
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Verify state
        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('user_id')
            .single();

        if (stateError || !stateData) {
            return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=error&reason=invalid_state`);
        }

        const userId = stateData.user_id;

        // 2. Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: ENV.GOOGLE_CLIENT_ID!,
                client_secret: ENV.GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${appUrl}/api/auth/google/calendar/callback`,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            throw new Error(tokens.error_description || 'Token exchange failed');
        }

        const { access_token, refresh_token, expires_in } = tokens;

        // Safety guard for expires_in to prevent NaN date crashes
        const secondsToExpiry = typeof expires_in === 'number' ? expires_in : parseInt(expires_in) || 3600;
        const expiresAt = new Date(Date.now() + secondsToExpiry * 1000).toISOString();

        // 3. Save tokens
        const { error: upsertError } = await supabaseAdmin
            .from('google_calendar_tokens')
            .upsert({
                user_id: userId,
                access_token,
                refresh_token,
                expires_at: expiresAt,
                last_synced_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            });

        if (upsertError) throw upsertError;

        return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=connected`);
    } catch (err) {
        console.error('Google Calendar Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=error`);
    }
}
