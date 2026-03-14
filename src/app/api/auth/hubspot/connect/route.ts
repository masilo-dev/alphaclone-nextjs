import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';

export async function GET(req: NextRequest) {
    const supabaseAdmin = createSupabaseAdminClient();
    
    // 1. Get user session (or userId from query for testing/integration)
    // In a real app, this should come from a secure session
    // For this implementation, we'll assume the client passes a state that we link to the user
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const stateNonce = crypto.randomUUID();

        // 2. Store verifier and user_id in oauth_states table
        // We need to add 'code_verifier' to this table or use a new one
        // For simplicity, we'll store it as metadata or in a dedicated column
        const { error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .insert({
                id: stateNonce,
                user_id: userId,
                metadata: {
                    code_verifier: codeVerifier,
                    provider: 'hubspot'
                }
            });

        if (stateError) throw stateError;

        // 3. Build HubSpot authorization URL
        const clientId = ENV.HUBSPOT_CLIENT_ID;
        const redirectUri = ENV.HUBSPOT_REDIRECT_URI;
        
        // Scopes needed for contacts and lead management
        const scopes = [
            'crm.objects.contacts.read',
            'crm.objects.contacts.write',
            'crm.schemas.contacts.read'
        ].join(' ');

        const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
        authUrl.searchParams.set('client_id', clientId!);
        authUrl.searchParams.set('redirect_uri', redirectUri!);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('state', stateNonce);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        return NextResponse.redirect(authUrl.toString());
    } catch (err: any) {
        console.error('HubSpot Connect Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
