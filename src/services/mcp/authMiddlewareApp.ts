import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { lookupMcpApiKey } from '@/lib/security/mcpApiKeyLookup';
import { normalizeMcpResourceUrl } from '@/lib/mcp/oauthRedirect';

export interface AuthResult {
  tenant_id: string;
  user_id: string;
  apiKey: string;
  supabaseAdmin: SupabaseClient;
  resource?: string;
  scope?: string[];
  client_id?: string;
}

export interface AuthError {
  error: string;
  status: number;
  wwwAuthenticate?: string;
}

/**
 * Creates a RFC 6750 compliant WWW-Authenticate header value
 */
export function createWWWAuthenticateHeader(
  error: string = 'invalid_token',
  description?: string,
  scopes?: string[]
): string {
  let header = `Bearer realm="alphaclone-mcp", error="${error}"`;

  if (description) {
    header += `, error_description="${description}"`;
  }

  if (scopes && scopes.length > 0) {
    header += `, scope="${scopes.join(' ')}"`;
  }

  return header;
}

/**
 * Validates that the request's resource (URL) matches the token's intended audience.
 *
 * Per RFC 8707: Resource indicators prevent token mis-redemption attacks where a token
 * issued for one resource is used to access another.
 */
function validateResource(
  tokenResource: string | null | undefined,
  requestUrl: string,
  baseUrl: string
): { valid: boolean; error?: string } {
  // If no resource was specified during token issuance, allow all
  if (!tokenResource) {
    return { valid: true };
  }

  // Normalize URLs for comparison
  const normalizeUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  };

  const normalizedTokenResource = normalizeUrl(normalizeMcpResourceUrl(tokenResource) || tokenResource);
  const normalizedRequestUrl = normalizeUrl(requestUrl);

  // Check exact match
  if (normalizedTokenResource === normalizedRequestUrl) {
    return { valid: true };
  }

  // Check if request URL starts with token resource (for sub-resource access)
  // Example: token issued for /api/mcp should work for /api/mcp/tools
  if (normalizedRequestUrl.startsWith(normalizedTokenResource + '/')) {
    return { valid: true };
  }

  // Special case: token issued for /api/mcp should work for the base MCP endpoints
  const expectedResource = normalizeUrl(`${baseUrl}/api/mcp`);
  if (normalizedTokenResource === expectedResource &&
      (normalizedRequestUrl === expectedResource ||
       normalizedRequestUrl.startsWith(expectedResource + '/'))) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Token intended for ${tokenResource} but used for ${requestUrl}`,
  };
}

/**
 * Validates that the client has the required scope for the requested operation.
 */
function validateScope(
  tokenScopes: string[] | null | undefined,
  requiredScopes: string[]
): { valid: boolean; missing?: string[] } {
  if (!requiredScopes || requiredScopes.length === 0) {
    return { valid: true };
  }

  const scopes = tokenScopes || ['read', 'write']; // Default scopes
  const missing = requiredScopes.filter(required => !scopes.includes(required));

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

export async function validateMCPAuthApp(
  req: NextRequest,
  options?: {
    requiredScopes?: string[];
    requireResourceMatch?: boolean;
  }
): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  let token = req.headers.get('x-api-key') || url.searchParams.get('api_key');

  // Build base URL for resource validation
  const baseUrl = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || 'alphaclonesystems.com'}`;

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  token = token?.trim() || null;

  if (!token) {
    return {
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token header.',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader('invalid_token', 'Missing access token'),
    };
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: 'SERVER_CONFIGURATION_ERROR',
      status: 500,
      wwwAuthenticate: createWWWAuthenticateHeader('server_error', 'Server configuration error'),
    };
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: {
        'Accept': 'application/json',
        'X-Client-Info': 'mcp-auth-middleware-v2'
      }
    }
  });

  const isOAuthAccessToken = token.startsWith('mcp_at_');
  const isStaticApiKey = token.startsWith('ac_mcp_');

  if (!isOAuthAccessToken && !isStaticApiKey) {
    return {
      error: 'Unauthorized',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader('invalid_token', 'Invalid token format'),
    };
  }

  // ── 1. Check for OAuth Access Token ──────────────────────────────────────
  if (isOAuthAccessToken) {
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('mcp_oauth_tokens')
      .select('tenant_id, user_id, expires_at, client_id, revoked, resource, scopes')
      .eq('access_token', token)
      .eq('revoked', false)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.warn('[MCP Auth] Token lookup failed or token not found:', {
        error: tokenError?.message,
        code: tokenError?.code,
        hint: tokenError?.hint,
        token_prefix: token.substring(0, 10)
      });
      return {
        error: 'Invalid or expired access token',
        status: 401,
        wwwAuthenticate: createWWWAuthenticateHeader('invalid_token', 'Token not found or revoked'),
      };
    }

    // RFC 8707: Validate resource/audience if required
    if (options?.requireResourceMatch !== false) {
      const resourceValidation = validateResource(
        tokenData.resource,
        req.url,
        baseUrl
      );

      if (!resourceValidation.valid) {
        console.warn('[MCP Auth] Resource mismatch:', resourceValidation.error, {
          user_id: tokenData.user_id,
          token_resource: tokenData.resource,
          request_url: req.url,
        });
        return {
          error: 'Invalid token for this resource',
          status: 403,
          wwwAuthenticate: createWWWAuthenticateHeader(
            'insufficient_scope',
            'Token not valid for this resource'
          ),
        };
      }
    }

    // Validate scopes if required
    if (options?.requiredScopes && options.requiredScopes.length > 0) {
      const scopeValidation = validateScope(tokenData.scopes, options.requiredScopes);

      if (!scopeValidation.valid) {
        console.warn('[MCP Auth] Insufficient scope:', {
          user_id: tokenData.user_id,
          token_scopes: tokenData.scopes,
          required: options.requiredScopes,
          missing: scopeValidation.missing,
        });
        return {
          error: 'Insufficient scope',
          status: 403,
          wwwAuthenticate: createWWWAuthenticateHeader(
            'insufficient_scope',
            `Missing required scopes: ${scopeValidation.missing?.join(', ')}`,
            tokenData.scopes
          ),
        };
      }
    }

    const expiryDate = new Date(tokenData.expires_at);
    const now = new Date();

    if (expiryDate.getTime() < now.getTime()) {
      return {
        error: 'Access token has expired',
        status: 401,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'invalid_token',
          'Access token has expired. Reconnect ChatGPT or Claude and authorize again.'
        ),
      };
    }

    return {
      tenant_id: tokenData.tenant_id,
      user_id: tokenData.user_id,
      apiKey: token,
      supabaseAdmin,
      resource: tokenData.resource || `${baseUrl}/api/mcp`,
      scope: tokenData.scopes || ['read', 'write'],
      client_id: tokenData.client_id || undefined,
    };
  }

  // ── 2. Fallback to API Key ───────────────────────────────────────────────
  const keyData = await lookupMcpApiKey(supabaseAdmin, token);

  if (!keyData) {
    return {
      error: 'Unauthorized',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader('invalid_token', 'Invalid API key'),
    };
  }

  // Validate scopes for API keys too
  if (options?.requiredScopes && options.requiredScopes.length > 0) {
    const scopeValidation = validateScope(keyData.scopes, options.requiredScopes);

    if (!scopeValidation.valid) {
      return {
        error: 'Insufficient scope',
        status: 403,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'insufficient_scope',
          `Missing required scopes: ${scopeValidation.missing?.join(', ')}`,
          keyData.scopes ?? undefined
        ),
      };
    }
  }

  return {
    tenant_id: keyData.tenant_id,
    user_id: keyData.user_id,
    apiKey: token,
    supabaseAdmin,
    resource: `${baseUrl}/api/mcp`,
    scope: keyData.scopes || ['read', 'write'],
  };
}

/**
 * Enhanced validation with resource checking enabled by default.
 * Use this for all MCP endpoints that require strict RFC 8707 compliance.
 */
export async function validateMCPAuthStrict(req: NextRequest): Promise<AuthResult | AuthError> {
  return validateMCPAuthApp(req, { requireResourceMatch: true });
}

const ALLOWED_MCP_ORIGINS = [
  'https://claude.ai',
  'https://manus.ai',
  'https://grok.x.ai',
  'https://chatgpt.com',
  'https://chat.openai.com',
  'https://app.cursor.com', // Cursor AI IDE
];

export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_MCP_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version, x-client-label',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version, WWW-Authenticate',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

export function getMcpCorsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowedOrigin = origin && ALLOWED_MCP_ORIGINS.includes(origin) ? origin : ALLOWED_MCP_ORIGINS[0];

  return {
    ...MCP_CORS_HEADERS,
    'Access-Control-Allow-Origin': allowedOrigin,
  };
}

export function handleCorsApp(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getMcpCorsHeaders(req),
    });
  }
  return null;
}

/**
 * Creates a standardized 401 Unauthorized response with WWW-Authenticate header
 */
export function createUnauthorizedResponse(
  req: NextRequest,
  error: string = 'invalid_token',
  description?: string,
  scopes?: string[]
): NextResponse {
  const wwwAuthenticate = createWWWAuthenticateHeader(error, description, scopes);

  return NextResponse.json(
    {
      error,
      error_description: description || 'Authentication required',
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': wwwAuthenticate,
        ...getMcpCorsHeaders(req),
      },
    }
  );
}
