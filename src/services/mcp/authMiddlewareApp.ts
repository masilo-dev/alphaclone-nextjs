import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';

export async function validateMCPAuthApp(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  let token = req.headers.get('x-api-key') || url.searchParams.get('api_key');

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  token = token?.trim() || null;

  if (!token) {
    return {
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token header.',
      status: 401,
    };
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SERVER_CONFIGURATION_ERROR', status: 500 };
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: {
        'Accept': 'application/json',
        'X-Client-Info': 'mcp-auth-middleware-v2'
      }
    }
  });

  const isOAuthAccessToken = token.startsWith('mcp_at_');
  const isStaticApiKey = token.startsWith('ac_mcp_');

  if (!isOAuthAccessToken && !isStaticApiKey) {
    return { error: 'Unauthorized', status: 401 };
  }

  // ── 1. Check for OAuth Access Token ──────────────────────────────────────
  if (isOAuthAccessToken) {
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('mcp_oauth_tokens')
      .select('tenant_id, user_id, expires_at, client_id, revoked')
      .eq('access_token', token)
      .eq('revoked', false)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.warn('[MCP Auth] Token lookup failed or token not found:', {
        error: tokenError?.message,
        code: tokenError?.code,
        hint: tokenError?.hint,
        token_prefix: token.substring(0, 10)
      });
      return { error: 'Invalid or expired access token', status: 401 };
    }

    const expiryDate = new Date(tokenData.expires_at);
    const now = new Date();
    const gracePeriodMs = 120 * 60 * 1000; // 2 hour grace period for reconnecting desktop MCP clients

    if (expiryDate.getTime() + gracePeriodMs < now.getTime()) {
      const extendedExpiry = new Date(now.getTime() + 3600 * 1000).toISOString();
      const { error: extendError } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .update({ expires_at: extendedExpiry })
        .eq('access_token', token);

      if (extendError) {
        console.error('[MCP Auth] Failed to extend expired OAuth token:', extendError);
        return { error: 'Access token has expired', status: 401 };
      }

      console.info('[MCP Auth] Extended expired OAuth token for MCP reconnect', {
        client_id: tokenData.client_id,
        user_id: tokenData.user_id,
      });
    }

    return {
      tenant_id: tokenData.tenant_id,
      user_id: tokenData.user_id,
      apiKey: token,
      supabaseAdmin,
    };
  }

  // ── 2. Fallback to API Key ───────────────────────────────────────────────
  const { data: keyData, error: keyError } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('tenant_id, user_id')
    .eq('api_key', token)
    .maybeSingle();

  if (keyError || !keyData) {
    return { error: 'Unauthorized', status: 401 };
  }

  return {
    tenant_id: keyData.tenant_id,
    user_id: keyData.user_id,
    apiKey: token,
    supabaseAdmin,
  };
}

const ALLOWED_MCP_ORIGINS = [
  'https://claude.ai',
  'https://manus.ai',
  'https://grok.x.ai',
  'https://chatgpt.com',
  'https://chat.openai.com',
];

export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_MCP_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version, x-client-label',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

export function getMcpCorsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowedOrigin = origin && ALLOWED_MCP_ORIGINS.includes(origin) ? origin : ALLOWED_MCP_ORIGINS[0];
  
  return {
    ...MCP_CORS_HEADERS,
    'Access-Control-Allow-Origin': allowedOrigin,
  };
}

export function handleCorsApp(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getMcpCorsHeaders(req),
    });
  }
  return null;
}
