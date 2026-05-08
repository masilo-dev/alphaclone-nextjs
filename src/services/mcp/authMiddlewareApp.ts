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

  if (!token) {
    return {
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token header.',
      status: 401,
    };
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SERVER_CONFIGURATION_ERROR', status: 500 };
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  // ── 1. Check for OAuth Access Token ──────────────────────────────────────
  if (token.startsWith('mcp_at_')) {
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('mcp_oauth_tokens')
      .select('tenant_id, user_id, expires_at')
      .eq('access_token', token)
      .single();

    if (tokenError || !tokenData) {
      return { error: 'Invalid or expired access token', status: 401 };
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return { error: 'Access token has expired', status: 401 };
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
    .single();

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

export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version, x-client-label',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version',
  'Access-Control-Max-Age': '86400',
};

export function handleCorsApp(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: MCP_CORS_HEADERS,
    });
  }
  return null;
}
