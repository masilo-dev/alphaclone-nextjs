import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';
import { saveCalendlyIntegration } from '@/services/calendly/calendlyIntegrationService';
import {
    pullAndSyncCalendlyEvents,
    registerCalendlyWebhook,
    resolveTenantHostUser,
} from '@/lib/calendly/syncToNative';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.json({ error: `Calendly error: ${error} ` }, { status: 400 });
    }

    if (!code || !state) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: stateData, error: stateError } = await supabaseAdmin.from('oauth_states')
        .delete().eq('id', state).select('user_id, tenant_id, metadata, created_at').single();
    const stateCreatedAt = stateData?.created_at ? new Date(stateData.created_at).getTime() : 0;
    if (stateError || !stateData?.tenant_id || !stateData?.user_id || stateData.metadata?.provider !== 'calendly' || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60_000) {
        return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
    }

    const tenantId = stateData.tenant_id;

    const clientId = ENV.VITE_CALENDLY_CLIENT_ID;
    const clientSecret = ENV.CALENDLY_CLIENT_SECRET;
    const redirectUri = ENV.VITE_CALENDLY_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        return NextResponse.json({ error: 'Calendly OAuth is not configured' }, { status: 500 });
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

        if (tokens.error) {
            throw new Error(tokens.error_description || tokens.error);
        }

        // Get Calendly User Info
        const userResponse = await fetch('https://api.calendly.com/users/me', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        const userData = await userResponse.json();
        const userUri = userData.resource.uri;
        const schedulingUrl = userData.resource.scheduling_url;

        // Tenant row verified above; tokens stored in calendly_integration_secrets.
        const appOrigin = (ENV.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
        const webhookUrl = `${appOrigin}/api/webhooks/calendly`;
        const webhookSubscriptionUri = await registerCalendlyWebhook(
            tokens.access_token,
            userUri,
            webhookUrl
        );

        const calendlyConfig = await saveCalendlyIntegration({
            tenantId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            calendlyUserUri: userUri,
            eventUrl: schedulingUrl,
            webhookSubscriptionUri: webhookSubscriptionUri || undefined,
            webhookUrl,
        });
        const { error: connectionError } = await supabaseAdmin.from('tenant_integrations').upsert({
            tenant_id: tenantId, integration_id: 'calendly', status: 'connected',
            connected_at: new Date().toISOString(), configured_by: stateData.user_id,
            metadata: { calendlyUserUri: userUri },
        }, { onConflict: 'tenant_id,integration_id' });
        if (connectionError) throw connectionError;
        await supabaseAdmin.from('business_automation_events').insert({
            tenant_id: tenantId, event_type: 'integration_connected',
            payload: { integrationId: 'calendly', actorUserId: stateData.user_id },
        });

        const hostUserId = await resolveTenantHostUser(tenantId);
        if (hostUserId) {
            try {
                await pullAndSyncCalendlyEvents(tenantId, hostUserId, calendlyConfig);
            } catch (syncErr) {
                console.error('[Calendly] Initial sync after OAuth failed:', syncErr);
            }
        }

        return NextResponse.redirect(new URL('/dashboard/settings?tab=booking&success=calendly_connected', req.url));

    } catch (err: any) {
        console.error('Calendly OAuth Callback Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'auth/calendly/callback' });
    }
}
