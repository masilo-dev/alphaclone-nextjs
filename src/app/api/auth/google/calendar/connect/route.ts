import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    console.log('Google Calendar Connect Request:', { userId });

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!ENV.GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: 'Missing Google Client ID' }, { status: 500 });
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Generate and persist new secure state
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
        const redirectUri = `${appUrl}/api/auth/google/calendar/callback`;

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/drive.file',
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
    } catch (err: any) {
        console.error('Google Calendar Connect Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
