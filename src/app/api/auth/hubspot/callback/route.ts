import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { upsertHubSpotIntegration } from '@/services/hubspot/hubspotIntegrationService';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const stateNonce = searchParams.get('state');

    const appUrl = (ENV.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'https://alphaclonesystems.com').replace(/\/$/, '');

    if (!code || !stateNonce) {
        return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=error&reason=missing_params`);
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('*')
            .single();

        const stateCreatedAt = stateData?.created_at ? new Date(stateData.created_at).getTime() : 0;
        if (stateError || !stateData || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60_000) {
            console.error('[HubSpot Callback] Invalid state:', stateNonce);
            return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=error&reason=invalid_state`);
        }

        const userId = stateData.user_id;
        const tenantId = stateData.tenant_id;
        const codeVerifier = stateData.metadata?.code_verifier;

        if (!codeVerifier || !tenantId) {
            throw new Error('Code verifier not found in state data');
        }

        const clientId = ENV.HUBSPOT_CLIENT_ID;
        const clientSecret = ENV.HUBSPOT_CLIENT_SECRET;
        const redirectUri = ENV.HUBSPOT_REDIRECT_URI;

        const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
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

        const expiresAt = new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString();

        await upsertHubSpotIntegration({
            userId,
            tenantId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? null,
            expiryDate: expiresAt,
        });

        const { error: connectionError } = await supabaseAdmin.from('tenant_integrations').upsert({
            tenant_id: tenantId,
            integration_id: 'hubspot',
            status: 'connected',
            connected_at: new Date().toISOString(),
            configured_by: userId,
            metadata: { expiresAt },
        }, { onConflict: 'tenant_id,integration_id' });
        if (connectionError) throw connectionError;
        await supabaseAdmin.from('business_automation_events').insert({
            tenant_id: tenantId,
            event_type: 'integration_connected',
            payload: { integrationId: 'hubspot', actorUserId: userId },
        });

        return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=connected`);
    } catch (err: unknown) {
        console.error('HubSpot Callback Error:', err);
        return NextResponse.redirect(`${appUrl}/dashboard/settings?hubspot=error&reason=callback_failed`);
    }
}
