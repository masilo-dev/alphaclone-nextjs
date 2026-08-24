import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_APP_ORIGIN, PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';
import { ALL_MCP_SCOPES } from '@/lib/mcp/scopes';

/**
 * Always returns the configured public-facing HTTPS base URL.
 * Never derives OAuth issuer/resource from request Host / 0.0.0.0 / Railway internal.
 */
export function getMcpPublicBaseUrl(_req?: NextRequest): string {
  return PUBLIC_APP_ORIGIN;
}

function getDiscoveryHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mcp-version',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Origin, Access-Control-Request-Headers',
    'x-mcp-version': '2025-11-25',
    'x-protocol-version': '2025-11-25',
    'MCP-Protocol-Version': '2025-11-25',
  };
}

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
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: getDiscoveryHeaders(),
  });
}

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
