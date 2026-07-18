import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { upsertGoogleCalendarTokens } from '@/services/google/googleCalendarIntegrationService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';

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
            .select('user_id, tenant_id, created_at')
            .single();

        const stateCreatedAt = stateData?.created_at ? new Date(stateData.created_at).getTime() : 0;
        if (stateError || !stateData || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60_000) {
            return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=error&reason=invalid_state`);
        }

        const userId = stateData.user_id;
        const tenantId = stateData.tenant_id;
        if (!tenantId) {
            return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=error&reason=invalid_state`);
        }

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
        await upsertGoogleCalendarTokens({
            userId,
            tenantId,
            accessToken: access_token,
            refreshToken: refresh_token ?? null,
            expiresAt,
        });

        const { error: connectionError } = await supabaseAdmin.from('tenant_integrations').upsert({
            tenant_id: tenantId,
            integration_id: 'google-calendar',
            status: 'connected',
            connected_at: new Date().toISOString(),
            configured_by: userId,
            metadata: { expiresAt },
        }, { onConflict: 'tenant_id,integration_id' });
        if (connectionError) throw connectionError;
        await supabaseAdmin.from('business_automation_events').insert({
            tenant_id: tenantId,
            event_type: 'integration_connected',
            payload: { integrationId: 'google-calendar', actorUserId: userId },
        });

        return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=connected`);
    } catch (err) {
        console.error('Google Calendar Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?calendar=error`);
    }
}
