import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

/**
 * MCP OAuth2 Token Endpoint
 *
 * Supports:
 *  - authorization_code (with PKCE S256 validation)
 *  - refresh_token
 *  - client_credentials (API-key-based, for legacy agent compatibility)
 *
 * RFC 6749 / RFC 7636 compliant.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS_HEADERS }
  );
}

/**
 * Verifies PKCE S256: SHA-256(code_verifier) === base64url(code_challenge)
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
      const formData = await req.formData();
      body = Object.fromEntries(
        Array.from(formData.entries()).map(([k, v]) => [k, String(v)])
      );
    } else {
      body = await req.json();
    }

    const {
      grant_type,
      client_id,
      client_secret,
      code,
      redirect_uri,
      code_verifier,
      refresh_token,
    } = body;

    console.log('[MCP Token] grant_type:', grant_type, 'client_id:', client_id);

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return tokenError('server_error', 'Server configuration error', 500);
    }

    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: {
          'Accept': 'application/json',
          'X-Client-Info': 'mcp-token-endpoint-v2'
        }
      }
    });

    // ── 1. AUTHORIZATION CODE FLOW ─────────────────────────────────────────
    if (grant_type === 'authorization_code') {
      if (!code) return tokenError('invalid_request', 'code is required');
      if (!redirect_uri) return tokenError('invalid_request', 'redirect_uri is required');

      // Look up the authorization code
      const { data: authCode, error: codeError } = await supabase
        .from('mcp_oauth_codes')
        .select('*')
        .eq('code', code)
        .single();

      if (codeError || !authCode) {
        console.warn('[MCP Token] Auth code not found:', code);
        return tokenError('invalid_grant', 'Authorization code is invalid or expired', 401);
      }

      // Verify code hasn't been used (single-use)
      if (authCode.used) {
        console.warn('[MCP Token] Code replay attack detected:', code);
        return tokenError('invalid_grant', 'Authorization code has already been used', 401);
      }

      // Verify not expired
      if (new Date(authCode.expires_at) < new Date()) {
        console.warn('[MCP Token] Auth code expired:', code);
        return tokenError('invalid_grant', 'Authorization code has expired', 401);
      }

      // Verify client_id (if code was issued to a specific client)
      if (authCode.client_id && client_id && authCode.client_id !== client_id) {
        console.warn('[MCP Token] client_id mismatch. Code client:', authCode.client_id, 'Request client:', client_id);
        return tokenError('invalid_client', 'client_id does not match the authorization code', 401);
      }

      // Verify redirect_uri matches (Relaxed comparison to avoid common OAuth URL issues)
      const cleanUrl = (u: string) => u.toLowerCase().replace(/\/$/, '').replace(/^http:/, 'https:');
      const requestRedirect = cleanUrl(redirect_uri);
      const storedRedirect = cleanUrl(authCode.redirect_uri);
      
      if (requestRedirect !== storedRedirect) {
        console.warn('[MCP Token] redirect_uri mismatch. Expected:', authCode.redirect_uri, 'Request:', redirect_uri);
        return tokenError('invalid_grant', 'redirect_uri does not match', 401);
      }

      // Verify PKCE if challenge was stored
      if (authCode.code_challenge) {
        if (!code_verifier) {
          return tokenError('invalid_request', 'code_verifier is required for PKCE');
        }
        if (authCode.code_challenge_method === 'S256') {
          const valid = await verifyPKCE(code_verifier, authCode.code_challenge);
          if (!valid) {
            console.warn('[MCP Token] PKCE verification failed');
            return tokenError('invalid_grant', 'code_verifier does not match code_challenge', 401);
          }
        }
        // plain method (less secure, but supported)
        if (authCode.code_challenge_method === 'plain' && code_verifier !== authCode.code_challenge) {
          return tokenError('invalid_grant', 'code_verifier does not match code_challenge', 401);
        }
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
        });

      if (tokenInsertError) {
        console.error('[MCP Token] Failed to store tokens:', tokenInsertError);
        return tokenError('server_error', 'Failed to issue tokens', 500);
      }

      console.log('[MCP Token] Tokens issued for user:', authCode.user_id, 'tenant:', authCode.tenant_id);

      return NextResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: (authCode.scopes || ['read', 'write']).join(' '),
      }, { headers: CORS_HEADERS });
    }

    // ── 2. REFRESH TOKEN FLOW ──────────────────────────────────────────────
    if (grant_type === 'refresh_token') {
      if (!refresh_token) return tokenError('invalid_request', 'refresh_token is required');

      const { data: session, error: sessionError } = await supabase
        .from('mcp_oauth_tokens')
        .select('*')
        .eq('refresh_token', refresh_token)
        .single();

      if (sessionError || !session) {
        return tokenError('invalid_grant', 'Refresh token is invalid or revoked', 401);
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
      });

      return NextResponse.json({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: (session.scopes || ['read', 'write']).join(' '),
      }, { headers: CORS_HEADERS });
    }

    // ── 3. CLIENT CREDENTIALS FLOW (Legacy / API-key agents) ──────────────
    if (grant_type === 'client_credentials') {
      const apiKey = client_secret || client_id;

      const { data: keyData, error: keyError } = await supabase
        .from('mcp_api_keys')
        .select('tenant_id, user_id')
        .eq('api_key', apiKey)
        .single();

      if (keyError || !keyData) {
        return tokenError('invalid_client', 'Invalid API key', 401);
      }

      // For client_credentials, return API key as access token (stateless, long-lived)
      return NextResponse.json({
        access_token: apiKey,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
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
