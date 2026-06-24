import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

/**
 * MCP OAuth2 Token Endpoint
 *
 * Supports:
 *  - authorization_code (with PKCE S256 validation - REQUIRED, plain is NOT supported)
 *  - refresh_token
 *  - client_credentials (API-key-based, for legacy agent compatibility)
 *
 * RFC 6749 / RFC 7636 (PKCE) / RFC 8707 (Resource Indicators) compliant.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

function getBaseUrl(req: NextRequest): string {
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'alphaclonesystems.com';
  return `${protocol}://${host}`;
}

function tokenError(
  error: string, 
  description: string, 
  status = 400,
  wwwAuthenticate?: string
) {
  const headers: Record<string, string> = { ...CORS_HEADERS };
  
  // RFC 6750: Include WWW-Authenticate header for 401 responses
  if (status === 401 || wwwAuthenticate) {
    headers['WWW-Authenticate'] = wwwAuthenticate || 
      `Bearer realm="alphaclone-mcp", error="${error}"${description ? `, error_description="${description}"` : ''}`;
  }
  
  return NextResponse.json(
    { error, error_description: description },
    { status, headers }
  );
}

/**
 * Authenticates a confidential client using client credentials.
 * 
 * Per RFC 6749 Section 2.3: Confidential clients MUST authenticate with the
 * token endpoint using their registered client credentials.
 */
interface ClientAuthResult {
  valid: boolean;
  client?: { id: string; is_public: boolean };
  error?: string;
}

async function authenticateClient(
  req: NextRequest,
  clientId: string | undefined,
  clientSecret: string | undefined,
  supabase: any
): Promise<ClientAuthResult> {
  // If no client_id provided, we'll accept but log (for public clients)
  if (!clientId) {
    return { valid: true };
  }

  // Look up the client
  const { data: client, error } = await supabase
    .from('mcp_oauth_clients')
    .select('id, client_id, is_public, client_secret')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !client) {
    console.warn('[MCP Token] Client authentication failed - client not found:', clientId);
    return { valid: false, error: 'invalid_client' };
  }

  // Public clients don't need to authenticate (they use PKCE)
  if (client.is_public) {
    return { valid: true, client: { id: clientId, is_public: true } };
  }

  // Confidential clients MUST provide client_secret
  // Try Authorization header first (Basic auth)
  const authHeader = req.headers.get('authorization');
  let providedSecret: string | null = clientSecret || null;

  if (authHeader?.startsWith('Basic ')) {
    try {
      const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
      const [basicClientId, basicSecret] = credentials.split(':');
      if (basicClientId === clientId) {
        providedSecret = basicSecret;
      }
    } catch {
      // Invalid Basic auth format
    }
  }

  // Verify client_secret for confidential clients
  if (!providedSecret || providedSecret !== client.client_secret) {
    console.warn('[MCP Token] Confidential client authentication failed - invalid secret:', {
      client_id: clientId,
      has_secret: !!providedSecret,
    });
    return { valid: false, error: 'invalid_client' };
  }

  return { valid: true, client: { id: clientId, is_public: false } };
}

/**
 * Verifies PKCE S256: SHA-256(code_verifier) === base64url(code_challenge)
 * 
 * Per MCP 2025-11-25 spec: S256 is REQUIRED, 'plain' is NOT permitted.
 */
async function verifyPKCE(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    // Standard Base64URL conversion for Node.js/Edge
    const base64 = Buffer.from(digest).toString('base64');
    const base64url = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
      
    const match = base64url === codeChallenge;
    if (!match) {
        console.warn('[PKCE] Mismatch. Expected:', codeChallenge, 'Got:', base64url);
    }
    return match;
  } catch (err) {
    console.error('[PKCE] Verification error:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Use req.text() — more reliable than req.formData() in Node.js runtime
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => { body[k] = v; });
    } else {
      body = await req.json().catch(() => ({}));
    }

    const {
      grant_type,
      client_id,
      client_secret,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
      resource, // RFC 8707 Resource Indicator
    } = body;

    console.log('[MCP Token] grant_type:', grant_type, 'client_id:', client_id);

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return tokenError('server_error', 'Server configuration error', 500);
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: {
          'Accept': 'application/json',
          'X-Client-Info': 'mcp-token-endpoint-v3'
        }
      }
    });

    // Expected resource identifier for this MCP server
    const baseUrl = getBaseUrl(req);
    const expectedResource = `${baseUrl}/api/mcp`;

    // Authenticate the client (required for confidential clients)
    const clientAuth = await authenticateClient(req, client_id, client_secret, supabase);
    if (!clientAuth.valid) {
      return tokenError(
        'invalid_client',
        'Client authentication failed. Confidential clients must provide valid client_secret.',
        401,
        'Bearer realm="alphaclone-mcp", error="invalid_client"'
      );
    }

    // ── 1. AUTHORIZATION CODE FLOW ─────────────────────────────────────────
    if (grant_type === 'authorization_code') {
      if (!code) return tokenError('invalid_request', 'code is required');
      if (!redirect_uri) return tokenError('invalid_request', 'redirect_uri is required');

      // Verify the code was issued to this client (if client_id provided)
      // For public clients, client_id matching is relaxed

      // RFC 8707: Validate resource indicator if provided
      if (resource && resource !== expectedResource) {
        console.warn('[MCP Token] Invalid resource indicator:', {
          expected: expectedResource,
          received: resource,
        });
        return tokenError(
          'invalid_target', 
          'Invalid resource indicator. Token cannot be used for the requested resource.',
          400
        );
      }

      // Look up the authorization code
      const { data: authCode, error: codeError } = await supabase
        .from('mcp_oauth_codes')
        .select('*')
        .eq('code', code)
        .single();

      if (codeError || !authCode) {
        console.warn('[MCP Token] Auth code not found:', code);
        return tokenError(
          'invalid_grant', 
          'Authorization code is invalid or expired', 
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      // Verify code hasn't been used (single-use)
      if (authCode.used) {
        console.warn('[MCP Token] Code replay attack detected:', code);
        return tokenError(
          'invalid_grant', 
          'Authorization code has already been used', 
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      // Verify not expired
      if (new Date(authCode.expires_at) < new Date()) {
        console.warn('[MCP Token] Auth code expired:', code);
        return tokenError(
          'invalid_grant', 
          'Authorization code has expired', 
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      // Verify client_id (if code was issued to a specific client)
      // For confidential clients, strict matching is required
      if (authCode.client_id && client_id && authCode.client_id !== client_id) {
        console.warn('[MCP Token] client_id mismatch. Code client:', authCode.client_id, 'Request client:', client_id);
        return tokenError(
          'invalid_client',
          'client_id does not match the authorization code',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_client"'
        );
      }

      // Confidential clients MUST authenticate and match the code's client
      if (!clientAuth.client?.is_public && authCode.client_id && (!client_id || authCode.client_id !== client_id)) {
        console.warn('[MCP Token] Confidential client must authenticate with matching client_id');
        return tokenError(
          'invalid_client',
          'Confidential clients must provide the client_id that matches the authorization code',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_client"'
        );
      }

      // Verify redirect_uri matches (Relaxed comparison to avoid common OAuth URL issues)
      const cleanUrl = (u: string) => u.toLowerCase().replace(/\/$/, '').replace(/^http:/, 'https:');
      const requestRedirect = cleanUrl(redirect_uri);
      const storedRedirect = cleanUrl(authCode.redirect_uri);
      
      if (requestRedirect !== storedRedirect) {
        console.warn('[MCP Token] redirect_uri mismatch.', {
          expected: authCode.redirect_uri,
          received: redirect_uri,
          code: authCode.code
        });
        return tokenError(
          'invalid_grant', 
          'redirect_uri does not match', 
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      // Verify PKCE if challenge was stored
      // Per MCP 2025-11-25: S256 is REQUIRED, 'plain' is NOT supported
      if (authCode.code_challenge) {
        if (!code_verifier) {
          console.warn('[MCP Token] Missing code_verifier for PKCE-enabled code');
          return tokenError(
            'invalid_request', 
            'code_verifier is required for PKCE'
          );
        }
        
        // Only S256 is supported - 'plain' is not permitted per MCP spec
        if (authCode.code_challenge_method === 'S256') {
          const valid = await verifyPKCE(code_verifier, authCode.code_challenge);
          if (!valid) {
            console.warn('[MCP Token] PKCE S256 verification failed');
            return tokenError(
              'invalid_grant', 
              'code_verifier does not match code_challenge', 
              401,
              'Bearer realm="alphaclone-mcp", error="invalid_grant"'
            );
          }
        } else if (authCode.code_challenge_method === 'plain') {
          // Reject 'plain' method - not secure and not supported per MCP spec
          console.warn('[MCP Token] Rejected PKCE plain method - not supported per MCP 2025-11-25 spec');
          return tokenError(
            'invalid_grant',
            'PKCE code_challenge_method "plain" is not supported. Use S256 only.',
            401,
            'Bearer realm="alphaclone-mcp", error="invalid_grant"'
          );
        } else {
          // Unknown method
          console.warn('[MCP Token] Unknown PKCE method:', authCode.code_challenge_method);
          return tokenError(
            'invalid_grant',
            `Unsupported PKCE code_challenge_method: ${authCode.code_challenge_method}`,
            401,
            'Bearer realm="alphaclone-mcp", error="invalid_grant"'
          );
        }
      }

      // Validate tenant context exists
      if (!authCode.tenant_id) {
        console.error('[MCP Token] Auth code has no associated tenant_id:', authCode.id);
        return tokenError('server_error', 'Invalid authorization context (missing tenant)', 500);
      }

      // Mark code as used (single-use enforcement)
      await supabase
        .from('mcp_oauth_codes')
        .update({ used: true })
        .eq('code', code);

      // Generate new access + refresh tokens
      const accessToken = `mcp_at_${crypto.randomUUID().replace(/-/g, '')}`;
      const refreshToken = `mcp_rt_${crypto.randomUUID().replace(/-/g, '')}`;
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

      // Include resource indicator in token metadata for audience validation
      const { error: tokenInsertError } = await supabase
        .from('mcp_oauth_tokens')
        .insert({
          access_token: accessToken,
          refresh_token: refreshToken,
          client_id: authCode.client_id || client_id || null,
          user_id: authCode.user_id,
          tenant_id: authCode.tenant_id,
          scopes: authCode.scopes || ['read', 'write'],
          expires_at: expiresAt,
          // Store the resource this token is intended for (RFC 8707)
          resource: expectedResource,
        });

      if (tokenInsertError) {
        console.error('[MCP Token] Failed to store tokens in DB:', {
          error: tokenInsertError,
          userId: authCode.user_id,
          tenantId: authCode.tenant_id
        });
        return tokenError('server_error', 'Failed to issue tokens (database error)', 500);
      }

      console.log('[MCP Token] SUCCESS. Issued for user:', authCode.user_id, 'tenant:', authCode.tenant_id);

      return NextResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: (authCode.scopes || ['read', 'write']).join(' '),
        // RFC 8707: Include the resource indicator in the response
        resource: expectedResource,
      }, { headers: CORS_HEADERS });
    }

    // ── 2. REFRESH TOKEN FLOW ──────────────────────────────────────────────
    if (grant_type === 'refresh_token') {
      if (!refresh_token) return tokenError('invalid_request', 'refresh_token is required');

      // RFC 8707: Validate resource indicator if provided
      if (resource && resource !== expectedResource) {
        console.warn('[MCP Token] Invalid resource indicator on refresh:', {
          expected: expectedResource,
          received: resource,
        });
        return tokenError(
          'invalid_target',
          'Invalid resource indicator. Token cannot be used for the requested resource.',
          400
        );
      }

      const { data: session, error: sessionError } = await supabase
        .from('mcp_oauth_tokens')
        .select('*')
        .eq('refresh_token', refresh_token)
        .single();

      if (sessionError || !session) {
        return tokenError(
          'invalid_grant', 
          'Refresh token is invalid or revoked', 
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      // Rotate tokens
      const newAccessToken = `mcp_at_${crypto.randomUUID().replace(/-/g, '')}`;
      const newRefreshToken = `mcp_rt_${crypto.randomUUID().replace(/-/g, '')}`;
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      // Delete old token entry and insert fresh one
      await supabase.from('mcp_oauth_tokens').delete().eq('refresh_token', refresh_token);
      await supabase.from('mcp_oauth_tokens').insert({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        client_id: session.client_id,
        user_id: session.user_id,
        tenant_id: session.tenant_id,
        scopes: session.scopes,
        expires_at: expiresAt,
        resource: expectedResource,
      });

      return NextResponse.json({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: (session.scopes || ['read', 'write']).join(' '),
        resource: expectedResource,
      }, { headers: CORS_HEADERS });
    }

    // ── 3. CLIENT CREDENTIALS FLOW (Legacy / API-key agents) ──────────────
    if (grant_type === 'client_credentials') {
      // RFC 8707: Validate resource indicator if provided
      if (resource && resource !== expectedResource) {
        console.warn('[MCP Token] Invalid resource indicator on client_credentials:', {
          expected: expectedResource,
          received: resource,
        });
        return tokenError(
          'invalid_target',
          'Invalid resource indicator. Token cannot be used for the requested resource.',
          400
        );
      }

      const apiKey = client_secret || client_id;

      const { data: keyData, error: keyError } = await supabase
        .from('mcp_api_keys')
        .select('tenant_id, user_id')
        .eq('api_key', apiKey)
        .single();

      if (keyError || !keyData) {
        return tokenError(
          'invalid_client', 
          'Invalid API key', 
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_client"'
        );
      }

      // For client_credentials, return API key as access token (stateless, long-lived)
      return NextResponse.json({
        access_token: apiKey,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
        resource: expectedResource,
      }, { headers: CORS_HEADERS });
    }

    return tokenError('unsupported_grant_type', `grant_type '${grant_type}' is not supported`);
  } catch (err) {
    console.error('[MCP Token] Unexpected error:', err);
    return tokenError('server_error', 'An unexpected error occurred', 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
