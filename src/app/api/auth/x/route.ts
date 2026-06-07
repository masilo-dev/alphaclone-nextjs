import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
// Always use the canonical non-www origin — X Developer Portal callback must match exactly.
const CANONICAL_APP_URL = 'https://alphaclonesystems.com';
const REDIRECT_URI = `${CANONICAL_APP_URL}/api/auth/callback/x`;

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    if (!X_CLIENT_ID) {
        return NextResponse.json({ error: 'X_CLIENT_ID not configured' }, { status: 500 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim() || '';
    let resolvedTenantId = tenantId;

    if (!resolvedTenantId) {
        const { data: tenantUser } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
        resolvedTenantId = tenantUser?.tenant_id || '';
    }

    if (!resolvedTenantId) {
        return NextResponse.json({ error: 'No workspace found for your account' }, { status: 403 });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const stateNonce = crypto.randomUUID();

    const supabaseAdmin = createSupabaseAdminClient();
    const { error: stateError } = await supabaseAdmin.from('oauth_states').insert({
        id: stateNonce,
        user_id: user.id,
        tenant_id: resolvedTenantId,
        metadata: {
            code_verifier: codeVerifier,
            provider: 'x',
        },
    });

    if (stateError) {
        console.error('[X OAuth] Failed to store state:', stateError);
        return NextResponse.json({ error: 'Failed to start OAuth flow' }, { status: 500 });
    }

    const scopes = [
        'tweet.read',
        'tweet.write',
        'users.read',
        'direct_messages.read',
        'direct_messages.write',
        'offline.access',
    ].join(' ');

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', X_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', stateNonce);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(authUrl.toString());
}
