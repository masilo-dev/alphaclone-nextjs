import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import {
    CLAUDE_OAUTH_REDIRECT_URIS,
    isRedirectUriAllowed,
    normalizeMcpClientId,
    PLATFORM_MCP_OAUTH_CLIENT_IDS,
} from '@/lib/mcp/oauthRedirect';
import { PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const INACTIVE_STATUSES = new Set(['suspended', 'removed', 'invited', 'pending']);

function isActiveStatus(status: unknown): boolean {
    const s = String(status || 'active').toLowerCase().trim();
    return !INACTIVE_STATUSES.has(s);
}

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined): boolean {
    if (!error) return false;
    return (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /column|does not exist/i.test(error.message || '')
    );
}

/**
 * MCP OAuth2 Approve Endpoint — UI-based authorization code issuance
 *
 * Called by the /authorize page after user clicks "Authorize Access".
 * Requires an authenticated AlphaClone session — user_id is taken from the session,
 * never from the request body.
 */
export async function POST(req: Request) {
    const started = Date.now();
    try {
        const { user } = await requireAuthenticatedUser(req);
        const body = await req.json().catch(() => ({}));
        const {
            client_id: rawClientId,
            redirect_uri,
            state,
            code_challenge,
            code_challenge_method,
            scope = 'read write',
        } = body as Record<string, unknown>;
        const user_id = user.id;
        const client_id = normalizeMcpClientId(typeof rawClientId === 'string' ? rawClientId : null)
            ?? (typeof rawClientId === 'string' ? rawClientId : null);

        if (!redirect_uri || typeof redirect_uri !== 'string') {
            return NextResponse.json({ error: 'Missing required parameter: redirect_uri' }, { status: 400 });
        }

        if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'server_error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // ── Resolve tenant (active membership only; bootstrap if missing) ─
        let tenant_id: string | undefined;

        let membershipQuery = await supabaseAdmin
            .from('tenant_users')
            .select('tenant_id, role, status')
            .eq('user_id', user_id)
            .limit(20);

        if (isMissingColumnError(membershipQuery.error)) {
            membershipQuery = await supabaseAdmin
                .from('tenant_users')
                .select('tenant_id, role')
                .eq('user_id', user_id)
                .limit(20);
        }

        if (!membershipQuery.error && Array.isArray(membershipQuery.data) && membershipQuery.data.length) {
            const active = membershipQuery.data.find((m) =>
                isActiveStatus((m as { status?: string }).status)
            );
            tenant_id = active?.tenant_id;
            if (!tenant_id) {
                return NextResponse.json(
                    {
                        error: 'Workspace membership is not active',
                        error_description:
                            'Your Alphaclone workspace membership is inactive. Open the dashboard, reactivate or create a workspace, then reconnect Claude.',
                    },
                    { status: 403 }
                );
            }
        }

        if (!tenant_id) {
            const alt = await supabaseAdmin
                .from('tenant_members')
                .select('tenant_id, status')
                .eq('user_id', user_id)
                .limit(20);
            if (!alt.error && Array.isArray(alt.data)) {
                tenant_id = alt.data.find((m) => isActiveStatus((m as { status?: string }).status))?.tenant_id;
            }
        }

        // Same as /auth/callback: first-time / incomplete signup users get a workspace here
        // so Claude OAuth does not fail with "No active workspace".
        if (!tenant_id) {
            try {
                const { bootstrapTenantForUser } = await import('@/lib/tenant/bootstrapTenantServer');
                const name = String(
                    user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        user.email?.split('@')[0] ||
                        'User'
                ).trim();
                const workspaceName = `${name}'s Workspace`;
                const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
                const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${randomSuffix}`;
                const bootstrapped = await bootstrapTenantForUser(supabaseAdmin, user, {
                    name: workspaceName,
                    slug,
                    plan: 'starter',
                    mode: 'ensure',
                    idempotencyKey: 'mcp-oauth-approve-v1',
                });
                tenant_id = bootstrapped.tenantId;
                console.log('[OAuth Approve] Bootstrapped workspace for user:', user_id, tenant_id);
            } catch (bootErr) {
                console.error('[OAuth Approve] Workspace bootstrap failed:', bootErr);
                return NextResponse.json(
                    {
                        error: 'No active workspace found for your account',
                        error_description:
                            'Sign in at alphaclonesystems.com, finish workspace setup, then reconnect Claude.',
                    },
                    { status: 403 }
                );
            }
        }

        if (!tenant_id) {
            return NextResponse.json(
                {
                    error: 'No active workspace found for your account',
                    error_description:
                        'Sign in at alphaclonesystems.com, finish workspace setup, then reconnect Claude.',
                },
                { status: 403 }
            );
        }

        if (client_id) {
            let { data: existingClient } = await supabaseAdmin
                .from('mcp_oauth_clients')
                .select('client_id, redirect_uris, is_public')
                .eq('client_id', client_id)
                .maybeSingle();

            // Seed/merge known platform clients (Claude) so redirect allowlists stay complete
            if (
                (!existingClient || !existingClient.redirect_uris?.length) &&
                PLATFORM_MCP_OAUTH_CLIENT_IDS.has(client_id)
            ) {
                const { ensurePlatformMcpOAuthClient } = await import('@/lib/mcp/ensureOAuthClient');
                await ensurePlatformMcpOAuthClient(supabaseAdmin, client_id);
                ({ data: existingClient } = await supabaseAdmin
                    .from('mcp_oauth_clients')
                    .select('client_id, redirect_uris, is_public')
                    .eq('client_id', client_id)
                    .maybeSingle());
            }

            const seedFallback =
                client_id === '1778309945386-41bab8272f61' ||
                client_id === 'CLAUDE' ||
                client_id === 'claude-web'
                    ? [...CLAUDE_OAUTH_REDIRECT_URIS]
                    : [];
            const allowedUris = [
                ...new Set([
                    ...(Array.isArray(existingClient?.redirect_uris)
                        ? existingClient.redirect_uris.map(String)
                        : []),
                    ...seedFallback,
                ]),
            ];

            if (allowedUris.length) {
                if (!isRedirectUriAllowed(redirect_uri, allowedUris)) {
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
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const scopes =
            typeof scope === 'string'
                ? scope
                      .split(/[\s+]+/)
                      .map((s: string) => (s === 'wrie' ? 'write' : s))
                      .filter(Boolean)
                      .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i)
                : Array.isArray(scope)
                  ? scope.map(String)
                  : ['read', 'write'];

        const codeRow: Record<string, unknown> = {
            code,
            client_id: client_id || null,
            user_id,
            tenant_id,
            redirect_uri,
            scopes,
            expires_at: expiresAt,
            code_challenge: typeof code_challenge === 'string' ? code_challenge : null,
            code_challenge_method: code_challenge
                ? (typeof code_challenge_method === 'string' ? code_challenge_method : 'S256')
                : null,
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

        console.log('[OAuth Approve] Auth code issued', {
            user_id,
            client_id,
            tenant_id,
            ms: Date.now() - started,
        });

        const url = new URL(redirect_uri);
        url.searchParams.set('code', code);
        if (typeof state === 'string' && state) url.searchParams.set('state', state);

        return NextResponse.json({ redirectUrl: url.toString() });
    } catch (err: unknown) {
        console.error('[OAuth Approve] Failed', { ms: Date.now() - started, err });
        return routeErrorResponse(err, 'OAuth approval failed', req);
    }
}
