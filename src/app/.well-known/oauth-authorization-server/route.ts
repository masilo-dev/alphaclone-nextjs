import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { MCP_OAUTH_SCOPES } from '@/services/mcp/MCPOAuthScopes';

export async function GET() {
  const baseUrl = ENV.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
  
  return NextResponse.json({
    "issuer": baseUrl,
    "authorization_endpoint": `${baseUrl}/oauth/authorize`,
    "token_endpoint": `${baseUrl}/api/oauth/token`,
    "registration_endpoint": `${baseUrl}/api/oauth/register`,
    "scopes_supported": ["read", "write", MCP_OAUTH_SCOPES.READ_ALL, MCP_OAUTH_SCOPES.WRITE_ALL],
    "response_types_supported": ["code"],
    "grant_types_supported": ["authorization_code", "refresh_token"],
    "token_endpoint_auth_methods_supported": ["none", "client_secret_basic", "client_secret_post"],
    "code_challenge_methods_supported": ["S256", "plain"]
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    }
  });
}
