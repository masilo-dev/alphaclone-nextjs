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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache',
  };
}

export function createProtectedResourceResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);

  return NextResponse.json(
    {
      resource: `${baseUrl}/api/mcp/sse`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header', 'query'],
      resource_documentation: `${baseUrl}/api/mcp/health`,
      scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    },
    {
      headers: getDiscoveryHeaders(),
    }
  );
}

export function createAuthorizationServerResponse(req: NextRequest) {
  const baseUrl = getBaseUrl(req);

  return NextResponse.json(
    {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/api/mcp/token`,
      registration_endpoint: `${baseUrl}/api/mcp/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
      scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
      service_documentation: `${baseUrl}/api/mcp/health`,
    },
    {
      headers: getDiscoveryHeaders(),
    }
  );
}

export function createDiscoveryOptionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: getDiscoveryHeaders(),
  });
}
