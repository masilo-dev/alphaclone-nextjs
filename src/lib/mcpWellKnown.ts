import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_HOST = 'www.alphaclonesystems.com';

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || DEFAULT_HOST;
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

function getDiscoveryHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mcp-version',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Vary': 'Origin, Access-Control-Request-Headers',
    'x-mcp-version': '2025-06-18',
    'x-protocol-version': '2025-06-18',
  };
}

export function createProtectedResourceResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const data = {
    resource: `${baseUrl}/api/mcp/sse`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header', 'query'],
    resource_documentation: `${baseUrl}/api/mcp/health`,
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    resource_indicators_supported: true,
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: getDiscoveryHeaders(),
  });
}

export function createAuthorizationServerResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const data = {
    issuer: baseUrl,
    // Server-side automated endpoint (supports Authorization header for headless flow)
    authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
    // Human-facing UI endpoint (for users who prefer browser-based approval)
    human_authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    service_documentation: `${baseUrl}/api/mcp/health`,
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: getDiscoveryHeaders(),
  });
}

export function createDiscoveryOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: getDiscoveryHeaders(),
  });
}
