import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

/**
 * MCP OAuth2 Authorization Endpoint — Server-Side Automated Flow
 *
 * Enables Claude (and other pre-approved MCP clients) to obtain an
 * authorization code without manual user interaction, by presenting
 * a valid mcp_api_key in the Authorization header.
 *
 * Flow:
 *   GET /api/mcp/authorize
 *     ?response_type=code
 *     &client_id=<uuid>
 *     &redirect_uri=<url>
 *     &state=<opaque>
 *     &code_challenge=<base64url-sha256>
 *     &code_challenge_method=S256
 *   Headers: Authorization: Bearer <mcp_api_key>
 *         OR x-api-key: <mcp_api_key>
 *
 * Returns: 302 → redirect_uri?code=<auth_code>&state=<state>
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

function oauthError(redirectUri: string | null, error: string, description: string, state?: string | null) {
  if (redirectUri) {
    try {
      const url = new URL(redirectUri);
      url.searchParams.set('error', error);
      url.searchParams.set('error_description', description);
      if (state) url.searchParams.set('state', state);
      return Response.redirect(url.toString(), 302);
    } catch {
      // fall through to JSON error if redirect_uri is malformed
    }
  }
  return new Response(JSON.stringify({ error, error_description: description }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const responseType       = searchParams.get('response_type');
  const clientId           = searchParams.get('client_id');
  const redirectUri        = searchParams.get('redirect_uri');
  const state              = searchParams.get('state');
  const codeChallenge      = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';
  const scope              = searchParams.get('scope') || 'read write';

  console.log('[MCP Authorize] Request:', { responseType, clientId, redirectUri, state, codeChallengeMethod });

  // ── Validate required params ──────────────────────────────────────────────
  if (responseType !== 'code') {
    return oauthError(redirectUri, 'unsupported_response_type', 'Only response_type=code is supported', state);
  }
  if (!clientId || !redirectUri) {
    return oauthError(redirectUri, 'invalid_request', 'client_id and redirect_uri are required', state);
  }

  // ── Extract API key from header ────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || '';
  const apiKeyHeader = req.headers.get('x-api-key') || '';
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : apiKeyHeader.trim();

  if (!apiKey) {
    return oauthError(redirectUri, 'access_denied',
      'Authorization header with a valid API key is required for automated flow', state);
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return oauthError(redirectUri, 'server_error', 'Server configuration error', state);
  }

  const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  // ── Validate API key → resolve tenant + user ──────────────────────────────
  const { data: keyData, error: keyError } = await supabase
    .from('mcp_api_keys')
    .select('tenant_id, user_id')
    .eq('api_key', apiKey)
    .single();

  if (keyError || !keyData) {
    console.warn('[MCP Authorize] Invalid API key presented');
    return oauthError(redirectUri, 'access_denied', 'Invalid or revoked API key', state);
  }

  // ── Validate client_id + redirect_uri ─────────────────────────────────────
  const { data: client, error: clientError } = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, redirect_uris, is_public')
    .eq('client_id', clientId)
    .single();

  if (clientError || !client) {
    console.warn('[MCP Authorize] Unknown client_id:', clientId);
    return oauthError(redirectUri, 'invalid_client', 'Unknown client_id', state);
  }

  const allowedRedirects: string[] = client.redirect_uris || [];
  if (!allowedRedirects.includes(redirectUri)) {
    console.warn('[MCP Authorize] redirect_uri mismatch. Got:', redirectUri, 'Allowed:', allowedRedirects);
    return oauthError(null, 'invalid_request', 'redirect_uri is not registered for this client', state);
  }

  // ── Generate single-use authorization code ────────────────────────────────
  const code = `ac_${crypto.randomUUID().replace(/-/g, '')}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const { error: insertError } = await supabase
    .from('mcp_oauth_codes')
    .insert({
      code,
      client_id: clientId,
      user_id: keyData.user_id,
      tenant_id: keyData.tenant_id,
      redirect_uri: redirectUri,
      scopes: scope.split(' ').filter(Boolean),
      expires_at: expiresAt,
      code_challenge: codeChallenge || null,
      code_challenge_method: codeChallenge ? codeChallengeMethod : null,
      used: false,
    });

  if (insertError) {
    console.error('[MCP Authorize] Failed to store auth code:', insertError);
    return oauthError(redirectUri, 'server_error', 'Failed to generate authorization code', state);
  }

  console.log('[MCP Authorize] Auth code issued for client:', clientId, '→ user:', keyData.user_id);

  // ── Redirect with code ────────────────────────────────────────────────────
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  return Response.redirect(callbackUrl.toString(), 302);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
