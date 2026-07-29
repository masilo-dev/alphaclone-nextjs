import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { PUBLIC_APP_ORIGIN, PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';
import { ALL_MCP_SCOPES } from '@/lib/mcp/scopes';

/**
 * Always returns the configured public-facing HTTPS base URL.
 * Never derives OAuth issuer/resource from request Host / 0.0.0.0 / Railway internal.
 */
export function getMcpPublicBaseUrl(_req?: NextRequest): string {
  return PUBLIC_APP_ORIGIN;
=======

const DEFAULT_HOST = 'www.alphaclonesystems.com';

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || DEFAULT_HOST;
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
>>>>>>> origin/main
}

function getDiscoveryHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mcp-version',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
<<<<<<< HEAD
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Origin, Access-Control-Request-Headers',
=======
    'Pragma': 'no-cache',
    'Expires': '0',
    'Vary': 'Origin, Access-Control-Request-Headers',
>>>>>>> origin/main
    'x-mcp-version': '2025-11-25',
    'x-protocol-version': '2025-11-25',
    'MCP-Protocol-Version': '2025-11-25',
  };
}

<<<<<<< HEAD
/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 */
export function createProtectedResourceResponse(_req?: NextRequest) {
  const baseUrl = PUBLIC_APP_ORIGIN;
  const data = {
    resource: PUBLIC_MCP_RESOURCE,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/api/mcp/health`,
    scopes_supported: [...ALL_MCP_SCOPES],
    resource_indicators_supported: true,
    authorization_server_metadata: {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
      token_endpoint: `${baseUrl}/api/mcp/token`,
      registration_endpoint: `${baseUrl}/api/mcp/register`,
      introspection_endpoint: `${baseUrl}/api/mcp/token/introspect`,
      revocation_endpoint: `${baseUrl}/api/mcp/token/revoke`,
      code_challenge_methods_supported: ['S256'],
    },
=======
export function createProtectedResourceResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const data = {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header', 'query'],
    resource_documentation: `${baseUrl}/api/mcp/health`,
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    resource_indicators_supported: true,
>>>>>>> origin/main
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: getDiscoveryHeaders(),
  });
}

<<<<<<< HEAD
/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
export function createAuthorizationServerResponse(_req?: NextRequest) {
  const baseUrl = PUBLIC_APP_ORIGIN;
  const data = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    introspection_endpoint: `${baseUrl}/api/mcp/token/introspect`,
    revocation_endpoint: `${baseUrl}/api/mcp/token/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    scopes_supported: [...ALL_MCP_SCOPES],
    service_documentation: `${baseUrl}/api/mcp/health`,
    require_pkce: true,
    resource_indicators_supported: true,
=======
export function createAuthorizationServerResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const data = {
    issuer: baseUrl,
    // MCP clients (headless) use /api/mcp/authorize with Bearer API key.
    // Human-facing login UI is at /authorize — kept as fallback_authorization_endpoint.
    authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
    fallback_authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/api/mcp/token`,
    registration_endpoint: `${baseUrl}/api/mcp/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    service_documentation: `${baseUrl}/api/mcp/health`,
>>>>>>> origin/main
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
