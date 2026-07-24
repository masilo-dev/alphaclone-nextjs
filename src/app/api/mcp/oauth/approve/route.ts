import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import {
    isRedirectUriAllowed,
    normalizeMcpClientId,
    PLATFORM_MCP_OAUTH_CLIENT_IDS,
} from '@/lib/mcp/oauthRedirect';
import { PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';

/**
 * MCP OAuth2 Approve Endpoint — UI-based authorization code issuance
 *
 * Called by the /authorize page after user clicks "Authorize Access".
 * Requires an authenticated AlphaClone session — user_id is taken from the session,
 * never from the request body.
 */
export async function POST(req: Request) {
    try {
        const { user } = await requireAuthenticatedUser(req);
        const body = await req.json();
        const {
            client_id: rawClientId,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method,
            scope = 'read write',
        } = body;
        const user_id = user.id;
        const client_id = normalizeMcpClientId(rawClientId) ?? rawClientId;

        if (!redirect_uri) {
            return NextResponse.json({ error: 'Missing required parameter: redirect_uri' }, { status: 400 });
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
            } else if (existingClient && !existingClient.redirect_uris?.length) {
                return NextResponse.json(
                    { error: 'Client has no registered redirect_uris' },
                    { status: 400 }
                );
            } else if (!PLATFORM_MCP_OAUTH_CLIENT_IDS.has(client_id)) {
                // Unknown clients must use Dynamic Client Registration — do not upsert here
                return NextResponse.json(
                    {
                        error: 'invalid_client',
                        error_description:
                            'Unknown client_id. Register via POST /api/mcp/register before authorizing.',
                    },
                    { status: 400 }
                );
            } else {
                return NextResponse.json(
                    {
                        error: 'invalid_client',
                        error_description: 'Platform client is not configured. Contact support.',
                    },
                    { status: 400 }
                );
            }
        }

        // ── Generate real single-use authorization code ────────────────────
        const code = `ac_${crypto.randomUUID().replace(/-/g, '')}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        const codeRow: Record<string, unknown> = {
                code,
                client_id: client_id || null,
                user_id,
                tenant_id,
                redirect_uri,
                    scopes: typeof scope === 'string'
                        ? scope
                            .split(/[\s+]+/)
                            .map((s: string) => (s === 'wrie' ? 'write' : s))
                            .filter(Boolean)
                            .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i)
                        : scope,
                expires_at: expiresAt,
                code_challenge: code_challenge || null,
                code_challenge_method: code_challenge ? (code_challenge_method || 'S256') : null,
                used: false,
                resource: PUBLIC_MCP_RESOURCE,
            };

        let { error: insertError } = await supabaseAdmin.from('mcp_oauth_codes').insert(codeRow);
        if (insertError?.code === '42703' || insertError?.message?.includes('resource')) {
            const { resource: _r, ...legacy } = codeRow;
            ({ error: insertError } = await supabaseAdmin.from('mcp_oauth_codes').insert(legacy));
        }

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
    } catch (err: unknown) {
        return routeErrorResponse(err, 'OAuth approval failed', req);
    }
}
