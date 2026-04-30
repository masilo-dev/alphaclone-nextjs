import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

/**
 * MCP OAuth2 Token Endpoint
 * Supports client_credentials and refresh_token flows for MCP agents.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      body = await req.json();
    }

    const { grant_type, client_id, client_secret, refresh_token } = body;

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Client Credentials Flow (often used by agents with an API key)
    if (grant_type === 'client_credentials') {
      // For AlphaClone, we map api_key to client_secret for simplicity in some agents
      const apiKey = client_secret || client_id;
      
      const { data: keyData, error: keyError } = await supabaseAdmin
        .from('mcp_api_keys')
        .select('tenant_id, user_id')
        .eq('api_key', apiKey)
        .single();

      if (keyError || !keyData) {
        return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
      }

      // Generate a temporary access token (in a real app this would be a JWT)
      // For now, we return the api_key as the access_token for statelessness
      return NextResponse.json({
        access_token: apiKey,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write'
      });
    }

    // 2. Refresh Token Flow
    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      }

      // Look up session by refresh token
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .select('*')
        .eq('refresh_token', refresh_token)
        .single();

      if (sessionError || !session) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 401 });
      }

      // In a real OAuth server, we'd generate a new token
      return NextResponse.json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: 'Bearer',
        expires_in: 3600
      });
    }

    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  } catch (err) {
    console.error('[MCP Token API] Error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
