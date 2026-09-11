import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { lookupMcpApiKey } from '@/lib/security/mcpApiKeyLookup';

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

function isMissingRevokedColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  return Boolean(error?.code === '42703' || error?.message?.includes('revoked'));
}

async function findActiveOAuthToken(
  supabase: any,
  column: 'access_token' | 'refresh_token',
  token: string,
  select: string
) {
  const withRevoked = await supabase
    .from('mcp_oauth_tokens')
    .select(`${select}, revoked`)
    .eq(column, token)
    .eq('revoked', false)
    .maybeSingle();

  if (!isMissingRevokedColumn(withRevoked.error)) {
    return { data: withRevoked.data as Record<string, any> | null, error: withRevoked.error };
  }

  const fallback = await supabase
    .from('mcp_oauth_tokens')
    .select(select)
    .eq(column, token)
    .maybeSingle();
  return { data: fallback.data as Record<string, any> | null, error: fallback.error };
}

async function markTokenRevoked(
  supabase: any,
  tokenId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('mcp_oauth_tokens')
    .update({
      revoked: true,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', tokenId);

  if (!error) return true;

  if (isMissingRevokedColumn(error)) {
    // Older schemas: delete the row so the token can no longer be used.
    const { error: deleteError } = await supabase.from('mcp_oauth_tokens').delete().eq('id', tokenId);
    return !deleteError;
  }

  console.warn('[MCP Token Revoke] Failed to revoke token:', error.message);
  return false;
}

/**
 * Authenticate the client making the revocation request.
 *
 * Confidential clients must authenticate (Basic).
 * Public clients may revoke by proving possession of the token being revoked
 * (token in body). Anonymous callers without a matching public-client token
 * are rejected.
 */
async function authenticateClient(
  req: NextRequest
): Promise<{ isAuthenticated: boolean; clientId?: string; isPublic?: boolean; error?: string }> {
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return { isAuthenticated: false, error: 'server_error' };
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    const { data: clientToken } = await findActiveOAuthToken(
      supabase,
      'access_token',
      token,
      'client_id, expires_at, user_id'
    );

    if (clientToken && new Date(clientToken.expires_at) > new Date()) {
      return { isAuthenticated: true, clientId: clientToken.client_id || undefined, isPublic: true };
    }

    const { data: apiKeyData } = await supabase
      .from('mcp_api_keys')
      .select('tenant_id, user_id')
      .eq('api_key', token)
      .eq('is_active', true)
      .maybeSingle();

    if (apiKeyData) {
      return { isAuthenticated: true, clientId: 'internal-service', isPublic: false };
    }

    return { isAuthenticated: false, error: 'invalid_client' };
  }

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
          return { isAuthenticated: true, clientId, isPublic: false };
        }
        if (clientData?.is_public) {
          return { isAuthenticated: true, clientId, isPublic: true };
        }
      }
    } catch {
      // Invalid Basic auth format
    }
    return { isAuthenticated: false, error: 'invalid_client' };
  }

  // No client auth — allow possession-based revocation only (validated later against token row)
  return { isAuthenticated: true, clientId: undefined, isPublic: true };
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

      const { data: tokenData } = await findActiveOAuthToken(
        supabase,
        'access_token',
        authToken,
        'user_id, tenant_id'
      );

      if (tokenData) {
        requestingUserId = tokenData.user_id;
        requestingTenantId = tokenData.tenant_id;
      } else {
        // Check API keys
        const keyData = await lookupMcpApiKey(supabase, authToken, { requireActive: true });

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
      const { data: tokenData } = await findActiveOAuthToken(
        supabase,
        'access_token',
        token,
        'id, user_id, tenant_id, access_token, client_id'
      );

      if (tokenData) {
        // Confidential / authenticated client may only revoke its own tokens
        if (
          auth.clientId &&
          auth.clientId !== 'internal-service' &&
          tokenData.client_id &&
          auth.clientId !== tokenData.client_id
        ) {
          return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        // User-bound bearer may only revoke own tokens
        if (requestingUserId && requestingUserId !== tokenData.user_id && auth.clientId !== 'internal-service') {
          console.warn('[MCP Token Revoke] Unauthorized revocation attempt', {
            requestingUser: requestingUserId,
            tokenUser: tokenData.user_id,
          });
          return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        // Unauthenticated possession-based revoke: require the token to belong to a public client
        if (!auth.clientId && !requestingUserId) {
          const { data: owningClient } = await supabase
            .from('mcp_oauth_clients')
            .select('is_public')
            .eq('client_id', tokenData.client_id)
            .maybeSingle();
          if (owningClient && owningClient.is_public === false) {
            return NextResponse.json(
              { error: 'invalid_client', error_description: 'Client authentication required to revoke this token' },
              { status: 401, headers: CORS_HEADERS }
            );
          }
        }

        if (await markTokenRevoked(supabase, tokenData.id)) {
          revoked = true;
          console.log('[MCP Token Revoke] Access token revoked:', {
            tokenId: tokenData.id,
            userId: tokenData.user_id,
            revokedBy: requestingUserId || auth.clientId || 'possession',
          });
        }
      }
    }

    // If not found as access token, try refresh token
    if (!revoked && (!tokenTypeHint || tokenTypeHint === 'refresh_token')) {
      const { data: tokenData } = await findActiveOAuthToken(
        supabase,
        'refresh_token',
        token,
        'id, user_id, tenant_id, refresh_token, client_id'
      );

      if (tokenData) {
        if (
          auth.clientId &&
          auth.clientId !== 'internal-service' &&
          tokenData.client_id &&
          auth.clientId !== tokenData.client_id
        ) {
          return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        if (requestingUserId && requestingUserId !== tokenData.user_id && auth.clientId !== 'internal-service') {
          console.warn('[MCP Token Revoke] Unauthorized refresh token revocation attempt', {
            requestingUser: requestingUserId,
            tokenUser: tokenData.user_id,
          });
          return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        if (!auth.clientId && !requestingUserId) {
          const { data: owningClient } = await supabase
            .from('mcp_oauth_clients')
            .select('is_public')
            .eq('client_id', tokenData.client_id)
            .maybeSingle();
          if (owningClient && owningClient.is_public === false) {
            return NextResponse.json(
              { error: 'invalid_client', error_description: 'Client authentication required to revoke this token' },
              { status: 401, headers: CORS_HEADERS }
            );
          }
        }

        if (await markTokenRevoked(supabase, tokenData.id)) {
          revoked = true;
          console.log('[MCP Token Revoke] Refresh token revoked:', {
            tokenId: tokenData.id,
            userId: tokenData.user_id,
            revokedBy: requestingUserId || auth.clientId || 'possession',
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
