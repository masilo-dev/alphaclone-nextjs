import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'}/api/auth/callback/x`;

export async function GET() {
    if (!X_CLIENT_ID) {
        return NextResponse.json({ error: 'X_CLIENT_ID not configured' }, { status: 500 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // PKCE implementation
    // For simplicity in this implementation, we use a random state
    const state = Math.random().toString(36).substring(7);
    const codeChallenge = 'challenge'; // In production, generate a real PKCE challenge
    
    // Scopes required for read, write, and direct messages
    const scopes = [
        'tweet.read',
        'tweet.write',
        'users.read',
        'direct_messages.read',
        'direct_messages.write',
        'offline.access' // For refresh token
    ].join(' ');

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', X_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'plain');

    return NextResponse.redirect(authUrl.toString());
}
