import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { xService } from '@/services/xService';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const APP_URL = PUBLIC_APP_ORIGIN;
const REDIRECT_URI = OAUTH_CALLBACKS.x;
const DASHBOARD_X = `${APP_URL}/dashboard/business/x`;

export const runtime = 'nodejs';
=======
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { xService } from '@/services/xService';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'}/api/auth/callback/x`;
>>>>>>> origin/main

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
<<<<<<< HEAD
    const stateNonce = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${DASHBOARD_X}?x_error=${encodeURIComponent(error)}`);
    }

    if (!code || !stateNonce) {
        return NextResponse.redirect(`${DASHBOARD_X}?x_error=missing_params`);
    }

    if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
        return NextResponse.redirect(`${DASHBOARD_X}?x_error=server_config`);
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        const { data: stateData, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .eq('id', stateNonce)
            .select('*')
            .single();

        if (stateError || !stateData) {
            return NextResponse.redirect(`${DASHBOARD_X}?x_error=invalid_state`);
        }

        const userId = stateData.user_id as string;
        const tenantId = stateData.tenant_id as string;
        const codeVerifier = (stateData.metadata as { code_verifier?: string } | null)?.code_verifier;

        if (!codeVerifier || !tenantId) {
            return NextResponse.redirect(`${DASHBOARD_X}?x_error=invalid_state`);
        }

        const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
        const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
=======
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=${error}`);
    }

    if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=no_code`);
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // Get current tenant
    const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

    if (!tenantUser) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=no_tenant`);
    }

    try {
        // Exchange code for token
        const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
        const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
>>>>>>> origin/main
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
<<<<<<< HEAD
                client_id: X_CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            console.error('X Token Exchange Error:', errorData);
            return NextResponse.redirect(`${DASHBOARD_X}?x_error=token_exchange_failed`);
=======
                redirect_uri: REDIRECT_URI,
                code_verifier: 'challenge' // Must match the one in /auth/x
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('X Token Exchange Error:', errorData);
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=token_exchange_failed`);
>>>>>>> origin/main
        }

        const tokens = await tokenResponse.json();

<<<<<<< HEAD
        const userResponse = await fetch('https://api.x.com/2/users/me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
=======
        // Get user info from X
        const userResponse = await fetch('https://api.twitter.com/2/users/me', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
>>>>>>> origin/main
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch X user info');
        }

        const { data: xUser } = await userResponse.json();
<<<<<<< HEAD
        const scopes = typeof tokens.scope === 'string'
            ? tokens.scope.split(' ').filter(Boolean)
            : [];

        await xService.saveXIntegration({
            tenant_id: tenantId,
            user_id: userId,
=======

        // Save integration
        await xService.saveXIntegration({
            tenant_id: tenantUser.tenant_id,
            user_id: user.id,
>>>>>>> origin/main
            x_user_id: xUser.id,
            x_username: xUser.username,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
<<<<<<< HEAD
            expires_at: new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString(),
            scopes,
        });

        return NextResponse.redirect(`${DASHBOARD_X}?x_connected=1`);
    } catch (err) {
        console.error('X Callback Error:', err);
        return NextResponse.redirect(`${DASHBOARD_X}?x_error=callback_failed`);
=======
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            scopes: tokens.scope.split(' ')
        });

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?success=x_connected`);
    } catch (err) {
        console.error('X Callback Error:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=callback_failed`);
>>>>>>> origin/main
    }
}
