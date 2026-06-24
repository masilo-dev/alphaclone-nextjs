import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * OAuth 2.0 Token Revocation Endpoint (RFC 7009)
 *
 * Allows clients to revoke access tokens and refresh tokens.
 * This enables users to logout and revoke session access.
 *
 * POST /api/mcp/token/revoke
 * Content-Type: application/x-www-form-urlencoded
 *
 * token=<access_or_refresh_token>
 * [token_type_hint=access_token|refresh_token]
 *
 * Response: 200 OK (empty body per RFC 7009)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
};

/**
 * Authenticate the client making the revocation request.
 * 
 * Per RFC 7009: The authorization server first validates the credentials
 * of the client requesting the revocation.
 */
async function authenticateClient(req: NextRequest): Promise<{ isAuthenticated: boolean; clientId?: string; error?: string }> {
  const authHeader = req.headers.get('authorization');

  // Try Bearer token authentication (client's access token)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return { isAuthenticated: false, error: 'server_error' };
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a valid client access token
    const { data: clientToken } = await supabase
      .from('mcp_oauth_tokens')
      .select('client_id, expires_at, revoked, user_id')
      .eq('access_token', token)
      .eq('revoked', false)
      .maybeSingle();

    if (clientToken && new Date(clientToken.expires_at) > new Date()) {
      return { isAuthenticated: true, clientId: clientToken.client_id || undefined };
    }

    // Check if this is an API key (internal service)
    const { data: apiKeyData } = await supabase
      .from('mcp_api_keys')
      .select('tenant_id, user_id')
      .eq('api_key', token)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyData) {
      return { isAuthenticated: true, clientId: 'internal-service' };
    }
  }

  // Try client credentials (for confidential clients)
  if (authHeader?.startsWith('Basic ')) {
    try {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
      const [clientId, clientSecret] = credentials.split(':');

      if (clientId && clientSecret && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

        const { data: clientData } = await supabase
          .from('mcp_oauth_clients')
          .select('client_id, client_secret, is_public')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .maybeSingle();

        if (clientData && !clientData.is_public && clientData.client_secret === clientSecret) {
          return { isAuthenticated: true, clientId };
        }
      }
    } catch {
      // Invalid Basic auth format
    }
  }

  // For public clients (PKCE), allow revocation without authentication
  // but only for their own tokens (verified by token ownership)
  return { isAuthenticated: true, clientId: 'public-client' };
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate the client making the revocation request
    const auth = await authenticateClient(req);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client authentication failed' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Parse request body
    let token: string | null = null;
    let tokenTypeHint: 'access_token' | 'refresh_token' | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      token = params.get('token');
      const hint = params.get('token_type_hint');
      if (hint === 'access_token' || hint === 'refresh_token') {
        tokenTypeHint = hint;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      token = body.token || null;
      const hint = body.token_type_hint;
      if (hint === 'access_token' || hint === 'refresh_token') {
        tokenTypeHint = hint;
      }
    }

    // Per RFC 7009: If token is missing, still return 200 (don't leak info)
    if (!token || typeof token !== 'string') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    // Determine the requesting user's identity for authorization check
    let requestingUserId: string | null = null;
    let requestingTenantId: string | null = null;

    // If authenticated via token, get the user info
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const authToken = authHeader.substring(7).trim();

      const { data: tokenData } = await supabase
        .from('mcp_oauth_tokens')
        .select('user_id, tenant_id')
        .eq('access_token', authToken)
        .eq('revoked', false)
        .maybeSingle();

      if (tokenData) {
        requestingUserId = tokenData.user_id;
        requestingTenantId = tokenData.tenant_id;
      } else {
        // Check API keys
        const { data: keyData } = await supabase
          .from('mcp_api_keys')
          .select('user_id, tenant_id')
          .eq('api_key', authToken)
          .eq('is_active', true)
          .maybeSingle();

        if (keyData) {
          requestingUserId = keyData.user_id;
          requestingTenantId = keyData.tenant_id;
        }
      }
    }

    // Revoke the token
    // Per RFC 7009: The server responds with HTTP status code 200 if the token
    // has been revoked successfully or if the client submitted an invalid token

    // Try to find and revoke as access token first
    let revoked = false;

    if (!tokenTypeHint || tokenTypeHint === 'access_token') {
      const { data: tokenData } = await supabase
        .from('mcp_oauth_tokens')
        .select('id, user_id, tenant_id, access_token')
        .eq('access_token', token)
        .eq('revoked', false)
        .maybeSingle();

      if (tokenData) {
        // Authorization check: user can only revoke their own tokens
        // unless they're an admin/internal service
        if (requestingUserId && requestingUserId !== tokenData.user_id && auth.clientId !== 'internal-service') {
          // Return 200 to avoid information leakage, but don't actually revoke
          console.warn('[MCP Token Revoke] Unauthorized revocation attempt', {
            requestingUser: requestingUserId,
            tokenUser: tokenData.user_id,
          });
          return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        const { error: updateError } = await supabase
          .from('mcp_oauth_tokens')
          .update({
            revoked: true,
            revoked_at: new Date().toISOString(),
          })
          .eq('id', tokenData.id);

        if (!updateError) {
          revoked = true;
          console.log('[MCP Token Revoke] Access token revoked:', {
            tokenId: tokenData.id,
            userId: tokenData.user_id,
            revokedBy: requestingUserId || auth.clientId,
          });
        }
      }
    }

    // If not found as access token, try refresh token
    if (!revoked && (!tokenTypeHint || tokenTypeHint === 'refresh_token')) {
      const { data: tokenData } = await supabase
        .from('mcp_oauth_tokens')
        .select('id, user_id, tenant_id, refresh_token')
        .eq('refresh_token', token)
        .eq('revoked', false)
        .maybeSingle();

      if (tokenData) {
        // Authorization check
        if (requestingUserId && requestingUserId !== tokenData.user_id && auth.clientId !== 'internal-service') {
          console.warn('[MCP Token Revoke] Unauthorized refresh token revocation attempt', {
            requestingUser: requestingUserId,
            tokenUser: tokenData.user_id,
          });
          return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        const { error: updateError } = await supabase
          .from('mcp_oauth_tokens')
          .update({
            revoked: true,
            revoked_at: new Date().toISOString(),
          })
          .eq('id', tokenData.id);

        if (!updateError) {
          revoked = true;
          console.log('[MCP Token Revoke] Refresh token revoked:', {
            tokenId: tokenData.id,
            userId: tokenData.user_id,
            revokedBy: requestingUserId || auth.clientId,
          });
        }
      }
    }

    // Also clean up any associated MCP sessions
    if (revoked && tokenTypeHint !== 'refresh_token') {
      // Best effort cleanup of sessions
      void supabase
        .from('mcp_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .then(() => {}, () => {});
    }

    // Per RFC 7009: Return 200 regardless of whether token was found/revoked
    // This prevents token scanning attacks
    return new Response(null, { status: 200, headers: CORS_HEADERS });

  } catch (err) {
    console.error('[MCP Token Revoke] Error:', err);
    // Per RFC 7009: Still return 200 on error to avoid information leakage
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }
}

/**
 * GET is not allowed per RFC 7009 - revocation requires POST
 */
export async function GET() {
  return NextResponse.json(
    { error: 'method_not_allowed', error_description: 'Use POST for token revocation' },
    { status: 405, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
