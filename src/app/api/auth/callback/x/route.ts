import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { xService } from '@/services/xService';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
// Always use the canonical non-www origin — must match X Developer Portal registration exactly.
const APP_URL = 'https://alphaclonesystems.com';
const REDIRECT_URI = `${APP_URL}/api/auth/callback/x`;
const DASHBOARD_X = `${APP_URL}/dashboard/business/x`;

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
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
        const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            console.error('X Token Exchange Error:', errorData);
            return NextResponse.redirect(`${DASHBOARD_X}?x_error=token_exchange_failed`);
        }

        const tokens = await tokenResponse.json();

        const userResponse = await fetch('https://api.twitter.com/2/users/me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch X user info');
        }

        const { data: xUser } = await userResponse.json();
        const scopes = typeof tokens.scope === 'string'
            ? tokens.scope.split(' ').filter(Boolean)
            : [];

        await xService.saveXIntegration({
            tenant_id: tenantId,
            user_id: userId,
            x_user_id: xUser.id,
            x_username: xUser.username,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString(),
            scopes,
        });

        return NextResponse.redirect(`${DASHBOARD_X}?x_connected=1`);
    } catch (err) {
        console.error('X Callback Error:', err);
        return NextResponse.redirect(`${DASHBOARD_X}?x_error=callback_failed`);
    }
}
