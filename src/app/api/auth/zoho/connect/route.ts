import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    console.log(`[Zoho Connect Debug] Received Connect Request for User: ${userId}`);

    if (!userId) {
        console.error('[Zoho Connect Debug] Missing userId in request');
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!ENV.ZOHO_CLIENT_ID) {
        console.error('[Zoho Connect Debug] ZOHO_CLIENT_ID is not configured in environment');
        return NextResponse.json({ error: 'Zoho Client ID not configured' }, { status: 500 });
    }

    try {
        const supabaseAdmin = createSupabaseAdminClient();

        // 1. Cleanup old states (> 1 hour)
        console.log('[Zoho Connect Debug] Cleaning up old OAuth states...');
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
        const { error: cleanupError } = await supabaseAdmin
            .from('oauth_states')
            .delete()
            .lt('created_at', oneHourAgo);
        
        if (cleanupError) console.warn('[Zoho Connect Debug] State cleanup warning:', cleanupError.message);

        // Support for different Zoho DCs (US, EU, IN, AU, JP, CA)
        const region = searchParams.get('region') || 'com';
        const accountsDomain = region === 'com' ? 'accounts.zoho.com' : `accounts.zoho.${region}`;

        // 2. Generate and persist new secure state
        console.log(`[Zoho Connect Debug] Generating secure state for user: ${userId} and region: ${region}`);
        const { data: stateRecord, error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .insert({ 
                user_id: userId,
                metadata: { region }
            })
            .select('id')
            .single();

        if (stateError || !stateRecord) {
            console.error(`[Zoho Connect Debug] Failed to generate state for user ${userId}:`, stateError);
            throw new Error('Failed to initialize secure connection. Database error.');
        }

        // Verification Check: Try to read it back immediately
        const { data: verifyRecord } = await supabaseAdmin
            .from('oauth_states')
            .select('id')
            .eq('id', stateRecord.id)
            .maybeSingle();
        
        if (!verifyRecord) {
            console.error(`[Zoho Connect Debug] Critical: State was inserted but could not be read back for ID: ${stateRecord.id}`);
        } else {
            console.log(`[Zoho Connect Debug] State Persisted and Verified in DB: ${stateRecord.id}`);
        }

        const stateNonce = stateRecord.id;
        console.log(`[Zoho Connect Debug] Generated State: ${stateNonce} for User: ${userId}`);
        
        const clientId = ENV.ZOHO_CLIENT_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || 'https://alphaclone.tech';
        const redirectUri = `${appUrl}/api/auth/zoho/callback`;

        console.log(`[Zoho Connect Debug] App URL: ${appUrl}, Redirect URI: ${redirectUri}`);


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

        console.log(`[Zoho Connect Debug] Redirecting to Zoho: ${authUrl.substring(0, 100)}...`);
        return NextResponse.redirect(authUrl);
    } catch (err: any) {
        console.error('[Zoho Connect Debug] Fatal Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
