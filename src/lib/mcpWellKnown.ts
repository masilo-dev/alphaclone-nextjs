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
    'x-mcp-version': '2025-11-25',
    'x-protocol-version': '2025-11-25',
    'MCP-Protocol-Version': '2025-11-25',
  };
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * 
 * This endpoint describes the MCP server as an OAuth 2.0 protected resource,
 * indicating which authorization servers can issue tokens for it.
 */
export function createProtectedResourceResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const data = {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    // RFC 6750: Tokens MUST be sent in the Authorization header, NEVER in query strings
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/api/mcp/health`,
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    resource_indicators_supported: true,
    // MCP 2025-11-25: Include authorization server metadata inline for convenience
    authorization_server_metadata: {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
      token_endpoint: `${baseUrl}/api/mcp/token`,
      registration_endpoint: `${baseUrl}/api/mcp/register`,
      introspection_endpoint: `${baseUrl}/api/mcp/token/introspect`,
      revocation_endpoint: `${baseUrl}/api/mcp/token/revoke`,
      code_challenge_methods_supported: ['S256'],
    },
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: getDiscoveryHeaders(),
  });
}

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * 
 * This endpoint describes the OAuth 2.0 authorization server capabilities,
 * including endpoints, grant types, and PKCE methods supported.
 */
export function createAuthorizationServerResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const data = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    introspection_endpoint: `${baseUrl}/api/mcp/token/introspect`,
    revocation_endpoint: `${baseUrl}/api/mcp/token/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    // MCP 2025-11-25: PKCE S256 is REQUIRED, 'plain' is NOT permitted
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    service_documentation: `${baseUrl}/api/mcp/health`,
    // Additional metadata for MCP compliance
    require_pkce: true,
    resource_indicators_supported: true,
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
