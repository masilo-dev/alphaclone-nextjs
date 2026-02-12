import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createAdminClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check for critical environment variables
    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
        return NextResponse.json({ error: 'Server configuration error: Missing Service Role Key' }, { status: 500 });
    }
    if (!ENV.GOOGLE_CLIENT_ID) {
        console.error('Missing GOOGLE_CLIENT_ID');
        return NextResponse.json({ error: 'Server configuration error: Missing Google Client ID' }, { status: 500 });
    }

    try {
        const supabaseAdmin = createAdminClient();

        // 1. Cleanup old states (> 1 hour)
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        await supabaseAdmin
            .from('oauth_states')
            .delete()
            .lt('created_at', oneHourAgo);

        // 2. Generate and persist new secure state
        const { data: stateRecord, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .insert({ user_id: userId })
            .select('id')
            .single();

        if (stateError || !stateRecord) {
            console.error('Failed to create OAuth state:', stateError);
            return NextResponse.json({ error: 'Failed to initialize secure connection' }, { status: 500 });
        }

        const stateNonce = stateRecord.id;
        const clientId = ENV.GOOGLE_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';
        const redirectUri = `${appUrl}/api/auth/google/gmail/callback`;

        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email',
            'openid'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `state=${stateNonce}`;

        return NextResponse.redirect(authUrl);
    } catch (err) {
        console.error('Gmail Connect Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
