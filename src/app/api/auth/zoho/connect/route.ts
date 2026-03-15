import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!ENV.ZOHO_CLIENT_ID) {
        return NextResponse.json({ error: 'Zoho Client ID not configured' }, { status: 500 });
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

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
            throw new Error('Failed to initialize secure connection');
        }

        const stateNonce = stateRecord.id;
        const clientId = ENV.ZOHO_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'https://alphaclone.tech';

        const redirectUri = `${appUrl}/api/auth/zoho/callback`;

        // Support for different Zoho DCs (US, EU, IN, AU, JP, CA)
        const region = searchParams.get('region') || 'com';
        const accountsDomain = region === 'com' ? 'accounts.zoho.com' : `accounts.zoho.${region}`;

        // Zoho Mail scopes
        const scopes = [
            'ZohoMail.messages.READ',
            'ZohoMail.messages.CREATE',
            'ZohoMail.messages.UPDATE',
            'ZohoMail.messages.DELETE',
            'ZohoMail.accounts.READ',
            'ZohoMail.folders.READ'
        ].join(',');

        const promptValue = searchParams.get('prompt') || 'consent';
        const authUrl = `https://${accountsDomain}/oauth/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=${scopes}&` +
            `access_type=offline&` +
            `prompt=${promptValue}&` +
            `state=${stateNonce}`;

        return NextResponse.redirect(authUrl);
    } catch (err: any) {
        console.error('Zoho Connect Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
