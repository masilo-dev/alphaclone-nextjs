import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import {
    isRedirectUriAllowed,
    normalizeMcpClientId,
    PLATFORM_MCP_OAUTH_CLIENT_IDS,
} from '@/lib/mcp/oauthRedirect';

/**
 * MCP OAuth2 Approve Endpoint — UI-based authorization code issuance
 *
 * Called by the /authorize page after user clicks "Authorize Access".
 * Issues a real, single-use authorization code (not the API key) stored
 * in mcp_oauth_codes, and returns the redirect URL.
 *
 * Body: {
 *   user_id: string,
 *   client_id: string,
 *   redirect_uri: string,
 *   state?: string,
 *   code_challenge?: string,
 *   code_challenge_method?: string,
 *   scope?: string,
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            user_id,
            client_id: rawClientId,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method,
            scope = 'read write',
        } = body;
        const client_id = normalizeMcpClientId(rawClientId) ?? rawClientId;

        if (!user_id || !redirect_uri) {
            return NextResponse.json({ error: 'Missing required parameters: user_id, redirect_uri' }, { status: 400 });
        }

        if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'server_error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

        // ── Resolve tenant ─────────────────────────────────────────────────
        const { data: tenantUser } = await supabaseAdmin
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user_id)
            .single();

        const tenant_id = tenantUser?.tenant_id;
        if (!tenant_id) {
            return NextResponse.json({ error: 'No workspace found for your account' }, { status: 403 });
        }

        if (client_id) {
            const { data: existingClient } = await supabaseAdmin
                .from('mcp_oauth_clients')
                .select('client_id, redirect_uris, is_public')
                .eq('client_id', client_id)
                .maybeSingle();

            if (existingClient?.redirect_uris?.length) {
                if (!isRedirectUriAllowed(redirect_uri, existingClient.redirect_uris)) {
                    return NextResponse.json(
                        { error: 'redirect_uri is not registered for this client' },
                        { status: 400 }
                    );
                }
            } else if (!PLATFORM_MCP_OAUTH_CLIENT_IDS.has(client_id)) {
                // Dynamic clients only — do not overwrite pre-registered platform redirect URIs
                await supabaseAdmin
                    .from('mcp_oauth_clients')
                    .upsert(
                        {
                            client_id,
                            client_name: client_id.startsWith('177') ? 'Claude Desktop' : client_id,
                            client_secret: 'dynamic',
                            redirect_uris: [redirect_uri],
                            is_public: true,
                            is_active: true,
                        },
                        { onConflict: 'client_id' }
                    );
            }
        }

        // ── Generate real single-use authorization code ────────────────────
        const code = `ac_${crypto.randomUUID().replace(/-/g, '')}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        const { error: insertError } = await supabaseAdmin
            .from('mcp_oauth_codes')
            .insert({
                code,
                client_id: client_id || null,
                user_id,
                tenant_id,
                redirect_uri,
                scopes: typeof scope === 'string' ? scope.split(' ').filter(Boolean) : scope,
                expires_at: expiresAt,
                code_challenge: code_challenge || null,
                code_challenge_method: code_challenge ? (code_challenge_method || 'S256') : null,
                used: false,
            });

        if (insertError) {
            console.error('[OAuth Approve] Failed to store auth code:', insertError);
            return NextResponse.json({ error: 'Failed to generate authorization code' }, { status: 500 });
        }

        console.log('[OAuth Approve] Auth code issued for user:', user_id, 'client:', client_id);

        // ── Build redirect URL ─────────────────────────────────────────────
        const url = new URL(redirect_uri);
        url.searchParams.set('code', code);
        if (state) url.searchParams.set('state', state);

        return NextResponse.json({ redirectUrl: url.toString() });
    } catch (err: any) {
        console.error('[OAuth Approve] Error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
