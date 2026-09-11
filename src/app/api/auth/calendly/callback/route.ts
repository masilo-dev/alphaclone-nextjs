import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';
import { saveCalendlyIntegration } from '@/services/calendly/calendlyIntegrationService';
import {
    pullAndSyncCalendlyEvents,
    registerCalendlyWebhook,
    resolveTenantHostUser,
} from '@/lib/calendly/syncToNative';
import { PUBLIC_APP_ORIGIN, publicAppUrl } from '@/lib/config/public-origin';

function redirectWithError(reason: string) {
    return NextResponse.redirect(
        publicAppUrl(`/dashboard/settings?tab=booking&error=${encodeURIComponent(reason)}`)
    );
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        console.error('[Calendly Callback] OAuth error from provider:', error);
        return redirectWithError(`Calendly error: ${error}`);
    }

    if (!code || !state) {
        return redirectWithError('Missing authorization code or state');
    }

    const supabaseAdmin = createSupabaseAdminClient();
    
    // First attempt atomic delete-and-select
    let { data: stateData, error: stateError } = await supabaseAdmin.from('oauth_states')
        .delete().eq('id', state).select('user_id, tenant_id, metadata, created_at').single();
    
    // Fallback lookup if state was already deleted by a browser pre-fetch or race condition
    if (stateError || !stateData) {
        const { data: maybeState } = await supabaseAdmin.from('oauth_states')
            .select('user_id, tenant_id, metadata, created_at')
            .eq('id', state)
            .maybeSingle();
        if (maybeState) {
            stateData = maybeState;
            stateError = null;
            await supabaseAdmin.from('oauth_states').delete().eq('id', state);
        }
    }

    const stateCreatedAt = stateData?.created_at ? new Date(stateData.created_at).getTime() : 0;
    if (
        stateError ||
        !stateData?.tenant_id ||
        !stateData?.user_id ||
        stateData.metadata?.provider !== 'calendly' ||
        !stateCreatedAt ||
        Date.now() - stateCreatedAt > 10 * 60_000
    ) {
        console.error('[Calendly Callback] Invalid or expired OAuth state:', { state, stateError, stateData });
        return redirectWithError('Invalid or expired OAuth state. Please try connecting again.');
    }

    const tenantId = stateData.tenant_id;
    const clientId = ENV.VITE_CALENDLY_CLIENT_ID;
    const clientSecret = ENV.CALENDLY_CLIENT_SECRET;
    const redirectUri = OAUTH_CALLBACKS.calendly;

    if (!clientId || !clientSecret || !redirectUri) {
        console.error('[Calendly Callback] OAuth credentials not configured');
        return redirectWithError('Calendly OAuth is not configured on server');
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri
            })
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok || tokens.error) {
            const errDesc = tokens.error_description || tokens.error || `HTTP ${tokenResponse.status}`;
            console.error('[Calendly Callback] Token exchange failed:', tokens);
            return redirectWithError(`Token exchange failed: ${errDesc}`);
        }

        // Get Calendly User Info
        const userResponse = await fetch('https://api.calendly.com/users/me', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        const userData = await userResponse.json();
        if (!userResponse.ok || userData.error || !userData.resource) {
            console.error('[Calendly Callback] Profile fetch failed:', userData);
            return redirectWithError('Failed to load user profile from Calendly');
        }

        const userUri = userData.resource.uri;
        const schedulingUrl = userData.resource.scheduling_url;
        const organizationUri = userData.resource.current_organization;

        const appOrigin = PUBLIC_APP_ORIGIN;
        const webhookUrl = `${appOrigin}/api/webhooks/calendly`;
        let webhookSubscriptionUri: string | null = null;
        try {
            webhookSubscriptionUri = await registerCalendlyWebhook(
                tokens.access_token,
                userUri,
                webhookUrl,
                organizationUri
            );
        } catch (whErr) {
            console.warn('[Calendly Callback] Webhook registration warning (continuing connection):', whErr);
        }

        const calendlyConfig = await saveCalendlyIntegration({
            tenantId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString(),
            calendlyUserUri: userUri,
            eventUrl: schedulingUrl,
            webhookSubscriptionUri: webhookSubscriptionUri || undefined,
            webhookUrl,
        });

        let { error: connectionError } = await supabaseAdmin.from('tenant_integrations').upsert({
            tenant_id: tenantId,
            integration_id: 'calendly',
            status: 'connected',
            connected_at: new Date().toISOString(),
            configured_by: stateData.user_id,
            metadata: { calendlyUserUri: userUri },
        }, { onConflict: 'tenant_id,integration_id' });

        if (connectionError && (connectionError.code === 'PGRST204' || /configured_by|schema cache/i.test(connectionError.message))) {
            const fallback = await supabaseAdmin.from('tenant_integrations').upsert({
                tenant_id: tenantId,
                integration_id: 'calendly',
                status: 'connected',
                connected_at: new Date().toISOString(),
                metadata: { calendlyUserUri: userUri },
            }, { onConflict: 'tenant_id,integration_id' });
            connectionError = fallback.error;
        }

        if (connectionError) {
            console.error('[Calendly Callback] tenant_integrations save error:', connectionError);
        }

        await supabaseAdmin.from('business_automation_events').insert({
            tenant_id: tenantId,
            event_type: 'integration_connected',
            payload: { integrationId: 'calendly', actorUserId: stateData.user_id },
        });

        const hostUserId = await resolveTenantHostUser(tenantId);
        if (hostUserId) {
            try {
                await pullAndSyncCalendlyEvents(tenantId, hostUserId, calendlyConfig);
            } catch (syncErr) {
                console.error('[Calendly Callback] Initial event sync failed:', syncErr);
            }
        }

        return NextResponse.redirect(
            publicAppUrl('/dashboard/settings?tab=booking&success=calendly_connected')
        );

    } catch (err: any) {
        console.error('[Calendly Callback] Exception during OAuth callback handling:', err);
        const msg = err instanceof Error ? err.message : 'Unknown processing error';
        return redirectWithError(msg);
    }
}
