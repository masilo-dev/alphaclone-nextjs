import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const returnTo = searchParams.get('returnTo') || '/dashboard/business/messages';

    console.log('Gmail Connect Request:', { userId, returnTo });

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check for critical environment variables
    console.log('Checking environment variables...');
    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return NextResponse.json({ error: 'Server configuration error: Missing Service Role Key' }, { status: 500 });
    }
    if (!ENV.GOOGLE_CLIENT_ID) {
        console.error('Missing GOOGLE_CLIENT_ID');
        return NextResponse.json({ error: 'Server configuration error: Missing Google Client ID' }, { status: 500 });
    }

    const safeReturnTo = returnTo.startsWith('/dashboard') ? returnTo : '/dashboard/business/messages';

    try {
        console.log('Creating admin client...');
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Cleanup old states (> 1 hour)
        console.log('Cleaning up old states...');
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const { error: cleanupError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .lt('created_at', oneHourAgo);

        if (cleanupError) {
            console.error('Cleanup error:', cleanupError);
            // Non-fatal, but good to know
        }

        // 2. Generate and persist new secure state
        console.log('Creating new OAuth state for user:', userId);
        const { data: stateRecord, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .insert({ user_id: userId })
            .select('id')
            .single();

        if (stateError || !stateRecord) {
            console.error('Failed to create OAuth state:', stateError);
            return NextResponse.json(
                { error: 'Failed to initialize secure connection', code: 'OAUTH_STATE_FAILED' },
                { status: 500 }
            );
        }

        const stateNonce = stateRecord.id;
        console.log('State nonce generated:', stateNonce);

        const clientId = ENV.GOOGLE_CLIENT_ID;
        const redirectUri = OAUTH_CALLBACKS.googleGmail;

        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/drive.file',
            'openid'
        ].join(' ');

        const encodedState = JSON.stringify({
            nonce: stateNonce,
            returnTo: safeReturnTo,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `state=${encodeURIComponent(encodedState)}`;

        console.log('Redirecting to Google Auth URL...');
        return NextResponse.redirect(authUrl);
    } catch (err: any) {
        console.error('Gmail Connect Error (caught):', err);
        return clientErrorResponse(err, { request: req, scope: 'auth/google/gmail/connect' });
    }
}
