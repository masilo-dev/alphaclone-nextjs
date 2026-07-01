import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { isProduction } from '@/lib/security/productionGuard';
import { hashMcpApiKey } from '@/lib/security/mcpKeyHash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * OAuth 2.0 Token Introspection Endpoint (RFC 7662)
 *
 * Allows resource servers (and authorized clients) to query the
 * authorization server about the status and metadata of an access token.
 *
 * POST /api/mcp/token/introspect
 * Content-Type: application/x-www-form-urlencoded
 *
 * token=<access_token>
 * [token_type_hint=access_token]
 *
 * Response:
 * {
 *   active: true|false,
 *   scope?: string,
 *   client_id?: string,
 *   username?: string,
 *   token_type?: "Bearer",
 *   exp?: number,
 *   iat?: number,
 *   nbf?: number,
 *   sub?: string,
 *   aud?: string,
 *   iss?: string,
 *   jti?: string
 * }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
};

/**
 * Authenticate the client making the introspection request.
 * 
 * Per RFC 7662: The authorization server MAY require authentication.
 * We allow:
 * 1. Bearer token from an authorized client (Authorization header)
 * 2. Client credentials (client_id + client_secret)
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
      .select('client_id, expires_at, revoked')
      .eq('access_token', token)
      .eq('revoked', false)
      .maybeSingle();

    if (clientToken && new Date(clientToken.expires_at) > new Date()) {
      return { isAuthenticated: true, clientId: clientToken.client_id || undefined };
    }

    // Check if this is an API key (internal service)
    const { data: apiKeyData } = await supabase
      .from('mcp_api_keys')
      .select('tenant_id')
      .or(`api_key.eq.${token},api_key_hash.eq.${hashMcpApiKey(token)}`)
      .maybeSingle();

    if (apiKeyData) {
      return { isAuthenticated: true, clientId: 'internal-service' };
    }
  }

  if (isProduction()) {
    return { isAuthenticated: false, error: 'invalid_client' };
  }

  return { isAuthenticated: true, clientId: 'development' };
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate the client making the introspection request
    const auth = await authenticateClient(req);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client authentication failed' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Parse request body
    let token: string | null = null;
    let tokenTypeHint: string | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      token = params.get('token');
      tokenTypeHint = params.get('token_type_hint');
    } else {
      const body = await req.json().catch(() => ({}));
      token = body.token || null;
      tokenTypeHint = body.token_type_hint || null;
    }

    // Per RFC 7662: If token is missing or invalid format, return { active: false }
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { active: false },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { active: false },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    // Look up the token
    let tokenData: {
      access_token?: string;
      refresh_token?: string;
      client_id?: string | null;
      user_id?: string;
      tenant_id?: string;
      scopes?: string[];
      expires_at?: string;
      revoked?: boolean;
      created_at?: string;
      resource?: string;
    } | null = null;

    // Try access token first
    const { data: accessTokenData } = await supabase
      .from('mcp_oauth_tokens')
      .select('access_token, refresh_token, client_id, user_id, tenant_id, scopes, expires_at, revoked, created_at, resource')
      .eq('access_token', token)
      .maybeSingle();

    if (accessTokenData) {
      tokenData = accessTokenData;
    } else if (tokenTypeHint !== 'access_token') {
      // Try refresh token if hint allows or no hint
      const { data: refreshTokenData } = await supabase
        .from('mcp_oauth_tokens')
        .select('access_token, refresh_token, client_id, user_id, tenant_id, scopes, expires_at, revoked, created_at, resource')
        .eq('refresh_token', token)
        .maybeSingle();

      if (refreshTokenData) {
        tokenData = refreshTokenData;
      }
    }

    // Token not found
    if (!tokenData) {
      return NextResponse.json(
        { active: false },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Check if token is expired or revoked
    const now = Math.floor(Date.now() / 1000);
    const exp = tokenData.expires_at ? Math.floor(new Date(tokenData.expires_at).getTime() / 1000) : 0;
    const isActive = !tokenData.revoked && exp > now;

    // RFC 7662 requires minimal response for inactive tokens
    if (!isActive) {
      return NextResponse.json(
        { active: false },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Build full introspection response for active token
    const baseUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'alphaclonesystems.com'}`;

    const response: Record<string, unknown> = {
      active: true,
      scope: (tokenData.scopes || ['read', 'write']).join(' '),
      client_id: tokenData.client_id,
      token_type: 'Bearer',
      exp,
      iat: tokenData.created_at ? Math.floor(new Date(tokenData.created_at).getTime() / 1000) : now,
      sub: tokenData.user_id,
      aud: tokenData.resource || `${baseUrl}/api/mcp`,
      iss: baseUrl,
    };

    // Optional fields
    if (tokenData.user_id) {
      // Could add username lookup here if needed
      response.username = tokenData.user_id; // Using ID as placeholder
    }

    if (tokenData.access_token === token) {
      response.jti = token.substring(0, 20); // Token identifier (first 20 chars)
    }

    return NextResponse.json(response, { status: 200, headers: CORS_HEADERS });

  } catch (err) {
    console.error('[MCP Token Introspection] Error:', err);
    // Per RFC 7662: On error, return { active: false }
    return NextResponse.json(
      { active: false },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

/**
 * GET is not allowed per RFC 7662 - introspection requires POST
 */
export async function GET() {
  return NextResponse.json(
    { error: 'method_not_allowed', error_description: 'Use POST for token introspection' },
    { status: 405, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
