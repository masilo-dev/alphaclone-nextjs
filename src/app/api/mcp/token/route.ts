import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'crypto';
import { ENV } from '@/config/env';
import { isMcpResourceEquivalent, normalizeMcpClientId, normalizeMcpResourceUrl, PLATFORM_MCP_OAUTH_CLIENT_IDS } from '@/lib/mcp/oauthRedirect';
import { lookupMcpApiKey } from '@/lib/security/mcpApiKeyLookup';
import { PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';
import { formatScopeString } from '@/lib/mcp/scopes';
import { loadMcpOAuthClient } from '@/lib/mcp/ensureOAuthClient';

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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
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
  if (!clientId) {
    return { valid: true };
  }

  const loaded = await loadMcpOAuthClient(supabase, clientId);
  const client = loaded.client;

  if (!client) {
    console.warn('[MCP Token] Client authentication failed - client not found:', clientId);
    return { valid: false, error: 'invalid_client' };
  }

  // Public clients / placeholder secrets don't need client_secret (PKCE).
  const placeholderSecret =
    !client.client_secret ||
    client.client_secret === 'public' ||
    client.client_secret === 'dynamic';
  if (client.is_public || placeholderSecret || PLATFORM_MCP_OAUTH_CLIENT_IDS.has(clientId)) {
    return { valid: true, client: { id: clientId, is_public: true } };
  }

  // Confidential clients MUST provide client_secret
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
      
    const match = timingSafeStringEqual(base64url, codeChallenge);
    if (!match) {
      console.warn('[PKCE] Mismatch (verifier does not match challenge)');
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
      client_id: rawClientId,
      client_secret,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
      resource, // RFC 8707 Resource Indicator
    } = body;
    const client_id = normalizeMcpClientId(rawClientId) ?? rawClientId;

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

    // Expected resource identifier — configured public MCP URL (never container host)
    const expectedResource = PUBLIC_MCP_RESOURCE;
    const normalizedResource = normalizeMcpResourceUrl(resource);

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
      if (resource && !isMcpResourceEquivalent(resource, expectedResource)) {
        console.warn('[MCP Token] Invalid resource indicator:', {
          expected: expectedResource,
          received: normalizedResource || resource,
        });
        return tokenError(
          'invalid_target', 
          'Invalid resource indicator. Token cannot be used for the requested resource.',
          400
        );
      }

      // Look up code first (do not reveal existence differences in error text)
      const { data: pendingCode, error: codeLookupError } = await supabase
        .from('mcp_oauth_codes')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (codeLookupError || !pendingCode) {
        console.warn('[MCP Token] Auth code invalid, expired, or already used');
        return tokenError(
          'invalid_grant',
          'Authorization code is invalid, expired, or already used.',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      if (pendingCode.used || pendingCode.consumed_at) {
        console.warn('[MCP Token] Code replay attack detected');
        return tokenError(
          'invalid_grant',
          'Authorization code is invalid, expired, or already used.',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      if (new Date(pendingCode.expires_at) < new Date()) {
        console.warn('[MCP Token] Auth code expired');
        return tokenError(
          'invalid_grant',
          'Authorization code is invalid, expired, or already used.',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      let authCode = pendingCode;

      // Verify client_id (if code was issued to a specific client)
      const storedClientId = normalizeMcpClientId(authCode.client_id) ?? authCode.client_id;
      if (storedClientId && client_id && storedClientId !== client_id) {
        console.warn('[MCP Token] client_id mismatch');
        return tokenError(
          'invalid_client',
          'client_id does not match the authorization code',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_client"'
        );
      }

      if (!clientAuth.client?.is_public && storedClientId && (!client_id || storedClientId !== client_id)) {
        console.warn('[MCP Token] Confidential client must authenticate with matching client_id');
        return tokenError(
          'invalid_client',
          'Confidential clients must provide the client_id that matches the authorization code',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_client"'
        );
      }

      const cleanUrl = (u: string) => u.toLowerCase().replace(/\/$/, '').replace(/^http:/, 'https:');
      if (cleanUrl(redirect_uri) !== cleanUrl(authCode.redirect_uri)) {
        console.warn('[MCP Token] redirect_uri mismatch');
        return tokenError(
          'invalid_grant',
          'redirect_uri does not match',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      if (authCode.code_challenge) {
        if (!code_verifier) {
          return tokenError('invalid_request', 'code_verifier is required for PKCE');
        }
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
          return tokenError(
            'invalid_grant',
            'PKCE code_challenge_method "plain" is not supported. Use S256 only.',
            401,
            'Bearer realm="alphaclone-mcp", error="invalid_grant"'
          );
        } else {
          return tokenError(
            'invalid_grant',
            `Unsupported PKCE code_challenge_method: ${authCode.code_challenge_method}`,
            401,
            'Bearer realm="alphaclone-mcp", error="invalid_grant"'
          );
        }
      }

      if (!authCode.tenant_id) {
        console.error('[MCP Token] Auth code missing tenant_id');
        return tokenError('server_error', 'Invalid authorization context (missing tenant)', 500);
      }

      // Atomic single-use consume after all validations
      const nowIso = new Date().toISOString();
      const consumeUpdate: Record<string, unknown> = { used: true, consumed_at: nowIso };
      let consumed = await supabase
        .from('mcp_oauth_codes')
        .update(consumeUpdate)
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', nowIso)
        .select('*')
        .maybeSingle();

      if (consumed.error?.code === '42703' || consumed.error?.message?.includes('consumed_at')) {
        consumed = await supabase
          .from('mcp_oauth_codes')
          .update({ used: true })
          .eq('code', code)
          .eq('used', false)
          .gt('expires_at', nowIso)
          .select('*')
          .maybeSingle();
      }

      if (consumed.error || !consumed.data) {
        console.warn('[MCP Token] Code replay race or already used');
        return tokenError(
          'invalid_grant',
          'Authorization code is invalid, expired, or already used.',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }
      authCode = consumed.data;

      // Generate new access + refresh tokens (store hashes + plaintext for compatibility)
      const accessToken = `mcp_at_${crypto.randomUUID().replace(/-/g, '')}`;
      const refreshToken = `mcp_rt_${crypto.randomUUID().replace(/-/g, '')}`;
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour
      const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      const tokenRow: Record<string, unknown> = {
        access_token: accessToken,
        refresh_token: refreshToken,
        access_token_hash: hashToken(accessToken),
        refresh_token_hash: hashToken(refreshToken),
        token_type: 'Bearer',
        client_id: storedClientId || client_id || null,
        user_id: authCode.user_id,
        tenant_id: authCode.tenant_id,
        scopes: authCode.scopes || ['read', 'write'],
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        revoked: false,
        resource: expectedResource,
      };

      let tokenInsertError = (await supabase.from('mcp_oauth_tokens').insert(tokenRow)).error;

      // Compatibility: older schemas without hash / refresh_expires_at columns
      if (tokenInsertError?.code === '42703') {
        const { access_token_hash: _a, refresh_token_hash: _r, refresh_expires_at: _e, token_type: _t, ...legacy } = tokenRow;
        tokenInsertError = (await supabase.from('mcp_oauth_tokens').insert(legacy)).error;
      }

      if (tokenInsertError) {
        console.error('[MCP Token] Failed to store tokens in DB:', {
          error: tokenInsertError.message,
          code: tokenInsertError.code,
          userId: authCode.user_id,
          tenantId: authCode.tenant_id,
        });
        return tokenError('server_error', 'Failed to issue tokens (database error)', 500);
      }

      console.log('[MCP Token] SUCCESS. Issued for user:', authCode.user_id, 'tenant:', authCode.tenant_id);

      return NextResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: formatScopeString(authCode.scopes || ['read', 'write']),
        resource: expectedResource,
      }, { headers: CORS_HEADERS });
    }

    // ── 2. REFRESH TOKEN FLOW ──────────────────────────────────────────────
    if (grant_type === 'refresh_token') {
      if (!refresh_token) return tokenError('invalid_request', 'refresh_token is required');

      // RFC 8707: Validate resource indicator if provided
      if (resource && !isMcpResourceEquivalent(resource, expectedResource)) {
        console.warn('[MCP Token] Invalid resource indicator on refresh:', {
          expected: expectedResource,
          received: normalizedResource || resource,
        });
        return tokenError(
          'invalid_target',
          'Invalid resource indicator. Token cannot be used for the requested resource.',
          400
        );
      }

      const refreshHash = hashToken(refresh_token);
      let session: Record<string, any> | null = null;

      // Prefer hash lookup; fall back to plaintext
      const byHash = await supabase
        .from('mcp_oauth_tokens')
        .select('*')
        .eq('refresh_token_hash', refreshHash)
        .eq('revoked', false)
        .maybeSingle();

      if (!byHash.error && byHash.data) {
        session = byHash.data;
      } else {
        const byPlain = await supabase
          .from('mcp_oauth_tokens')
          .select('*')
          .eq('refresh_token', refresh_token)
          .maybeSingle();
        session = byPlain.data;
        if (byPlain.error || !session) {
          return tokenError(
            'invalid_grant',
            'Refresh token is invalid or revoked',
            401,
            'Bearer realm="alphaclone-mcp", error="invalid_grant"'
          );
        }
        if (session.revoked === true) {
          return tokenError(
            'invalid_grant',
            'Refresh token is invalid or revoked',
            401,
            'Bearer realm="alphaclone-mcp", error="invalid_grant"'
          );
        }
      }

      if (session.refresh_expires_at && new Date(session.refresh_expires_at) < new Date()) {
        return tokenError(
          'invalid_grant',
          'Refresh token is invalid or revoked',
          401,
          'Bearer realm="alphaclone-mcp", error="invalid_grant"'
        );
      }

      // Rotate: revoke previous refresh atomically, issue new pair
      const newAccessToken = `mcp_at_${crypto.randomUUID().replace(/-/g, '')}`;
      const newRefreshToken = `mcp_rt_${crypto.randomUUID().replace(/-/g, '')}`;
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const boundResource = session.resource || expectedResource;

      if (session.id) {
        await supabase
          .from('mcp_oauth_tokens')
          .update({ revoked: true, revoked_at: new Date().toISOString() })
          .eq('id', session.id)
          .eq('revoked', false);
      } else {
        await supabase.from('mcp_oauth_tokens').delete().eq('refresh_token', refresh_token);
      }

      const rotateRow: Record<string, unknown> = {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        access_token_hash: hashToken(newAccessToken),
        refresh_token_hash: hashToken(newRefreshToken),
        token_type: 'Bearer',
        client_id: normalizeMcpClientId(session.client_id) ?? session.client_id,
        user_id: session.user_id,
        tenant_id: session.tenant_id,
        scopes: session.scopes,
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        revoked: false,
        resource: boundResource,
        token_family_id: session.token_family_id || session.id || null,
      };

      let rotateError = (await supabase.from('mcp_oauth_tokens').insert(rotateRow)).error;
      if (rotateError?.code === '42703') {
        const {
          access_token_hash: _a,
          refresh_token_hash: _r,
          refresh_expires_at: _e,
          token_type: _t,
          token_family_id: _f,
          ...legacy
        } = rotateRow;
        rotateError = (await supabase.from('mcp_oauth_tokens').insert(legacy)).error;
      }

      if (rotateError) {
        console.error('[MCP Token] Refresh rotation failed:', rotateError.message);
        return tokenError('server_error', 'Failed to rotate tokens', 500);
      }

      return NextResponse.json({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: formatScopeString(session.scopes || ['read', 'write']),
        resource: boundResource,
      }, { headers: CORS_HEADERS });
    }

    // ── 3. CLIENT CREDENTIALS FLOW (Legacy / API-key agents) ──────────────
    if (grant_type === 'client_credentials') {
      // RFC 8707: Validate resource indicator if provided
      if (resource && !isMcpResourceEquivalent(resource, expectedResource)) {
        console.warn('[MCP Token] Invalid resource indicator on client_credentials:', {
          expected: expectedResource,
          received: normalizedResource || resource,
        });
        return tokenError(
          'invalid_target',
          'Invalid resource indicator. Token cannot be used for the requested resource.',
          400
        );
      }

      const apiKey = client_secret || client_id;

      const keyData = await lookupMcpApiKey(supabase, String(apiKey || ''));

      if (!keyData) {
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
        scope: formatScopeString(['read', 'write', 'mcp:tools', 'mcp:resources']),
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
