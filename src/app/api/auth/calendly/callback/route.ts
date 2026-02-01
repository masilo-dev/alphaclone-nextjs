import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ENV } from '@/config/env';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.json({ error: `Calendly error: ${error}` }, { status: 400 });
    }

    if (!code || !state) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    let tenantId: string;
    try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        tenantId = decodedState.tenantId;
    } catch (e) {
        return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
    }

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

        // Save to Supabase
        const supabase = await createClient();

        // Get current settings first to preserve others
        const { data: tenant, error: fetchError } = await supabase
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (fetchError || !tenant) {
            throw new Error('Tenant not found');
        }

        const updatedSettings = {
            ...tenant.settings,
            calendly: {
                enabled: true,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                calendlyUserUri: userUri,
                eventUrl: schedulingUrl
            }
        };

        const { error: updateError } = await supabase
            .from('tenants')
            .update({ settings: updatedSettings })
            .eq('id', tenantId);

        if (updateError) throw updateError;

        // Redirect back to settings
        return NextResponse.redirect(new URL('/dashboard/settings?tab=booking&success=calendly_connected', req.url));

    } catch (err: any) {
        console.error('Calendly OAuth Callback Error:', err);
        return NextResponse.json({ error: err.message || 'Failed to connect Calendly' }, { status: 500 });
    }
}
