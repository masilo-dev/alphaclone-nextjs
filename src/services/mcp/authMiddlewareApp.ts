import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';

export async function validateMCPAuthApp(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  let api_key = req.headers.get('x-api-key') || url.searchParams.get('api_key');

  if (!api_key && authHeader && authHeader.startsWith('Bearer ')) {
    api_key = authHeader.substring(7);
  }

  if (!api_key) {
    return {
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token header.',
      status: 401,
    };
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'SERVER_CONFIGURATION_ERROR', status: 500 };
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  const { data: keyData, error: keyError } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('tenant_id, user_id')
    .eq('api_key', api_key)
    .single();

  if (keyError || !keyData) {
    return { error: 'Unauthorized', status: 401 };
  }

  return {
    tenant_id: keyData.tenant_id,
    user_id: keyData.user_id,
    apiKey: api_key,
    supabaseAdmin,
  };
}

export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version',
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
