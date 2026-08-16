import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';
import { requireTenantRole } from '@/lib/apiAuth';
import { OAUTH_CALLBACKS } from '@/lib/config/oauth-callbacks';

export async function GET(req: NextRequest) {
    const supabaseAdmin = createSupabaseAdminClient();
    
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '';

    try {
        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
        const userId = user.id;
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const stateNonce = crypto.randomUUID();

        // 2. Store verifier and user_id in oauth_states table
        // We need to add 'code_verifier' to this table or use a new one
        // For simplicity, we'll store it as metadata or in a dedicated column
        const { error: stateError } = await supabaseAdmin
            .from('oauth_states')
            .insert({
                id: stateNonce,
                user_id: userId,
                tenant_id: tenantId,
                metadata: {
                    code_verifier: codeVerifier,
                    provider: 'hubspot'
                }
            });

        if (stateError) throw stateError;

        // 3. Build HubSpot authorization URL
        const clientId = ENV.HUBSPOT_CLIENT_ID;
        const redirectUri = OAUTH_CALLBACKS.hubspot;
        
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
        return clientErrorResponse(err, { request: req, scope: 'auth/hubspot/connect' });
    }
}
