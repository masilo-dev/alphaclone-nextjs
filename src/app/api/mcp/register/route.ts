import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * OAuth 2.0 Dynamic Client Registration Endpoint (RFC 7591)
 * 
 * Allows MCP clients (Claude, ChatGPT, etc.) to dynamically register
 * and receive a unique client_id with their redirect_uris.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate server configuration
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // Parse request body
    let body: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => { body[k] = v; });
    }

    const { 
      redirect_uris, 
      client_name, 
      grant_types,
      response_types,
      scope,
      token_endpoint_auth_method 
    } = body;

    // Validate redirect_uris (required per RFC 7591)
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'redirect_uris is required and must be a non-empty array' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate each redirect_uri is a valid HTTPS URL (except localhost for development)
    const validatedUris: string[] = [];
    for (const uri of redirect_uris) {
      if (typeof uri !== 'string') {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'Each redirect_uri must be a string' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      
      try {
        const url = new URL(uri);
        // Allow http://localhost for development, require https:// for production
        if (url.protocol !== 'https:' && !(url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
          return NextResponse.json(
            { error: 'invalid_request', error_description: `Invalid redirect_uri: ${uri}. Must use HTTPS or localhost` },
            { status: 400, headers: CORS_HEADERS }
          );
        }
        validatedUris.push(uri);
      } catch {
        return NextResponse.json(
          { error: 'invalid_request', error_description: `Invalid redirect_uri format: ${uri}` },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // Generate unique client credentials
    const client_id = `ac_${crypto.randomUUID().replace(/-/g, '')}`;
    const now = Math.floor(Date.now() / 1000);
    
    // Public clients (PKCE) don't have secrets
    const isPublic = token_endpoint_auth_method === 'none' || !token_endpoint_auth_method;
    const client_secret = isPublic ? null : `cs_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // Connect to database
    const supabase = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    
    // Persist to mcp_oauth_clients table
    const { error: insertError } = await supabase
      .from('mcp_oauth_clients')
      .insert({
        client_id,
        client_name: client_name || 'MCP Client',
        redirect_uris: validatedUris,
        is_public: isPublic,
        client_secret,
        scopes: scope ? (scope as string).split(' ') : ['read', 'write', 'mcp:tools', 'mcp:resources'],
        grant_types: grant_types || ['authorization_code', 'refresh_token'],
        response_types: response_types || ['code'],
        token_endpoint_auth_method: token_endpoint_auth_method || 'none',
        is_active: true,
      });

    if (insertError) {
      console.error('[MCP Register] Database error:', insertError);
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to register client' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    console.log('[MCP Register] New client registered:', {
      client_id,
      client_name: client_name || 'MCP Client',
      redirect_uris: validatedUris,
      is_public: isPublic,
    });

    // Build RFC 7591 compliant response
    const response: Record<string, unknown> = {
      client_id,
      client_id_issued_at: now,
      client_name: client_name || 'MCP Client',
      redirect_uris: validatedUris,
      grant_types: grant_types || ['authorization_code', 'refresh_token'],
      response_types: response_types || ['code'],
      token_endpoint_auth_method: token_endpoint_auth_method || 'none',
      scope: scope || 'read write mcp:tools mcp:resources',
    };

    // Only include client_secret for confidential clients
    if (client_secret) {
      response.client_secret = client_secret;
      response.client_secret_expires_at = 0; // Never expires
    }

    return NextResponse.json(response, { 
      status: 201, 
      headers: CORS_HEADERS 
    });

  } catch (err) {
    console.error('[MCP Register] Unexpected error:', err);
    return NextResponse.json(
      { error: 'server_error', error_description: 'An unexpected error occurred' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
