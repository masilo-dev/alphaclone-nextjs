import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { lookupMcpApiKey } from '@/lib/security/mcpApiKeyLookup';
import { normalizeMcpResourceUrl } from '@/lib/mcp/oauthRedirect';
import {
  PUBLIC_APP_ORIGIN,
  PUBLIC_MCP_RESOURCE,
  normalizeResourceUrl,
  resourcesMatch,
} from '@/lib/config/public-origin';
import { hasRequiredScopes } from '@/lib/mcp/scopes';
import { logOAuthTokenLookup } from '@/lib/mcp/oauthTokenIsolation';
import { createHash } from 'crypto';

export interface AuthResult {
  tenant_id: string;
  user_id: string;
  apiKey: string;
  supabaseAdmin: SupabaseClient;
  resource?: string;
  scope?: string[];
  client_id?: string;
  token_id?: string;
}

export interface AuthError {
  error: string;
  status: number;
  wwwAuthenticate?: string;
}

export type MCPAuthContext = {
  tokenId: string;
  clientId: string;
  userId: string;
  tenantId: string;
  scopes: string[];
  resource: string;
};

/**
 * Creates a RFC 6750 + RFC 9728 compliant WWW-Authenticate header value.
 * MCP OAuth clients (ChatGPT Apps, Claude) require resource_metadata so they
 * can discover the authorization server after a 401 challenge.
 */
export function createWWWAuthenticateHeader(
  error: string = 'invalid_token',
  description?: string,
  scopes?: string[],
  resourceMetadataUrl?: string
): string {
  const parts: string[] = ['Bearer realm="alphaclone-mcp"'];

  if (resourceMetadataUrl) {
    parts.push(`resource_metadata="${resourceMetadataUrl}"`);
  }

  if (error) {
    parts.push(`error="${error}"`);
  }

  if (description) {
    parts.push(`error_description="${description.replace(/"/g, '\\"')}"`);
  }

  if (scopes && scopes.length > 0) {
    parts.push(`scope="${scopes.join(' ')}"`);
  }

  return parts.join(', ');
}

/** Always use the configured public origin — never request Host / 0.0.0.0. */
export function buildMcpResourceMetadataUrl(_req?: NextRequest): string {
  return `${PUBLIC_APP_ORIGIN}/.well-known/oauth-protected-resource`;
}

function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Validate token audience against the configured MCP resource identity.
 * Do NOT use request.url / internal Railway bindings (0.0.0.0:8080).
 */
function validateResource(
  tokenResource: string | null | undefined
): { valid: boolean; error?: string; configured?: string; token?: string } {
  if (!tokenResource) {
    return { valid: true };
  }

  const expected = PUBLIC_MCP_RESOURCE;
  const normalizedToken = normalizeMcpResourceUrl(tokenResource) || tokenResource;

  if (resourcesMatch(normalizedToken, expected)) {
    return { valid: true, configured: expected, token: normalizedToken };
  }

  // Also accept exact normalizeResourceUrl equality
  try {
    if (normalizeResourceUrl(normalizedToken) === normalizeResourceUrl(expected)) {
      return { valid: true, configured: expected, token: normalizedToken };
    }
  } catch {
    // fall through
  }

  return {
    valid: false,
    configured: expected,
    token: normalizedToken,
    error: 'Token resource mismatch',
  };
}

/**
 * Validates that the client has the required scope for the requested operation.
 */
function validateScope(
  tokenScopes: string[] | null | undefined,
  requiredScopes: string[]
): { valid: boolean; missing?: string[] } {
  const result = hasRequiredScopes(tokenScopes, requiredScopes);
  return { valid: result.valid, missing: result.missing };
}

async function lookupOAuthToken(
  supabaseAdmin: SupabaseClient,
  token: string
): Promise<{ data: Record<string, unknown> | null; error: { message?: string; code?: string; hint?: string } | null }> {
  const tokenHash = hashAccessToken(token);

  const isMissingCol = (err: { message?: string; code?: string } | null | undefined) =>
    !!err &&
    (err.code === '42703' ||
      err.code === 'PGRST204' ||
      /column|does not exist/i.test(err.message || ''));

  // Progressive lookups: newer schema → older production schemas missing revoked/resource/hash/id
  const attempts: Array<{
    select: string;
    match: 'hash' | 'plain';
    revokedFilter: boolean;
  }> = [
    {
      select: 'id, tenant_id, user_id, expires_at, client_id, revoked, resource, scopes, access_token',
      match: 'hash',
      revokedFilter: true,
    },
    {
      select: 'id, tenant_id, user_id, expires_at, client_id, revoked, resource, scopes',
      match: 'plain',
      revokedFilter: true,
    },
    {
      select: 'id, tenant_id, user_id, expires_at, client_id, resource, scopes',
      match: 'plain',
      revokedFilter: false,
    },
    {
      select: 'tenant_id, user_id, expires_at, client_id, scopes, resource',
      match: 'plain',
      revokedFilter: false,
    },
    {
      select: 'tenant_id, user_id, expires_at, client_id, scopes',
      match: 'plain',
      revokedFilter: false,
    },
    {
      select: 'tenant_id, user_id, expires_at, client_id',
      match: 'plain',
      revokedFilter: false,
    },
  ];

  let lastError: { message?: string; code?: string; hint?: string } | null = null;

  for (const attempt of attempts) {
    let query = supabaseAdmin.from('mcp_oauth_tokens').select(attempt.select);

    if (attempt.match === 'hash') {
      query = query.eq('access_token_hash', tokenHash);
    } else {
      query = query.eq('access_token', token);
    }

    if (attempt.revokedFilter) {
      query = query.eq('revoked', false);
    }

    const { data, error } = await query.maybeSingle();

        if (!error && data && typeof data === 'object') {
          return { data: data as unknown as Record<string, unknown>, error: null };
        }

    if (error) {
      lastError = error;
      // Missing column / schema drift → try next leaner shape
      if (isMissingCol(error)) continue;
      // Real lookup failure (not schema) — stop
      if (error.code && error.code !== 'PGRST116') {
        return { data: null, error };
      }
    }
  }

  // No row found after exhausting shapes
  return { data: null, error: lastError };
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
  const resourceMetadataUrl = buildMcpResourceMetadataUrl(req);
  const requestId = req.headers.get('x-request-id') || req.headers.get('x-correlation-id') || undefined;

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  token = token?.trim() || null;

  if (!token) {
    return {
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token header.',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader(
        'invalid_token',
        'Missing access token',
        undefined,
        resourceMetadataUrl
      ),
    };
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: 'SERVER_CONFIGURATION_ERROR',
      status: 500,
      wwwAuthenticate: createWWWAuthenticateHeader(
        'server_error',
        'Server configuration error',
        undefined,
        resourceMetadataUrl
      ),
    };
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Accept: 'application/json',
        'X-Client-Info': 'mcp-auth-middleware-v3',
      },
    },
  });

  const isOAuthAccessToken = token.startsWith('mcp_at_');
  const isStaticApiKey = token.startsWith('ac_mcp_');

  if (!isOAuthAccessToken && !isStaticApiKey) {
    return {
      error: 'Unauthorized',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader(
        'invalid_token',
        'Invalid token format',
        undefined,
        resourceMetadataUrl
      ),
    };
  }

  // ── 1. Check for OAuth Access Token ──────────────────────────────────────
  if (isOAuthAccessToken) {
    const { data: tokenData, error: tokenError } = await lookupOAuthToken(supabaseAdmin, token);

    if (tokenError || !tokenData) {
      logOAuthTokenLookup({
        outcome: 'miss',
        clientId: null,
        userId: null,
        tenantId: null,
        requestId,
      });
      console.warn('[MCP Auth] Token lookup failed or token not found:', {
        request_id: requestId,
        error: tokenError?.message,
        code: tokenError?.code,
        hint: tokenError?.hint,
        ...(process.env.NODE_ENV !== 'production'
          ? { token_prefix: token.substring(0, 10) }
          : {}),
      });
      return {
        error: 'Invalid or expired access token',
        status: 401,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'invalid_token',
          'Token not found or revoked',
          undefined,
          resourceMetadataUrl
        ),
      };
    }

    if (tokenData.revoked === true) {
      logOAuthTokenLookup({
        outcome: 'revoked',
        clientId: tokenData.client_id as string | undefined,
        userId: tokenData.user_id as string | undefined,
        tenantId: tokenData.tenant_id as string | undefined,
        tokenId: tokenData.id as string | undefined,
        requestId,
      });
      return {
        error: 'Invalid or expired access token',
        status: 401,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'invalid_token',
          'Token not found or revoked',
          undefined,
          resourceMetadataUrl
        ),
      };
    }

    // RFC 8707: Validate against configured public MCP resource (not request host)
    if (options?.requireResourceMatch !== false) {
      const resourceValidation = validateResource(tokenData.resource as string | null | undefined);

      if (!resourceValidation.valid) {
        logOAuthTokenLookup({
          outcome: 'resource_mismatch',
          clientId: tokenData.client_id as string | undefined,
          userId: tokenData.user_id as string | undefined,
          tenantId: tokenData.tenant_id as string | undefined,
          tokenId: tokenData.id as string | undefined,
          requestId,
        });
        console.warn('[MCP Auth] Resource mismatch', {
          request_id: requestId,
          client_id: tokenData.client_id,
          user_id: tokenData.user_id,
          tenant_id: tokenData.tenant_id,
          configured_resource: resourceValidation.configured,
          token_resource: resourceValidation.token,
          reason: resourceValidation.error,
        });
        return {
          error: 'Invalid token for this resource',
          status: 403,
          wwwAuthenticate: createWWWAuthenticateHeader(
            'insufficient_scope',
            'Token not valid for this resource',
            undefined,
            resourceMetadataUrl
          ),
        };
      }
    }

    // Validate scopes if required
    if (options?.requiredScopes && options.requiredScopes.length > 0) {
      const scopeValidation = validateScope(
        tokenData.scopes as string[] | null | undefined,
        options.requiredScopes
      );

      if (!scopeValidation.valid) {
        logOAuthTokenLookup({
          outcome: 'insufficient_scope',
          clientId: tokenData.client_id as string | undefined,
          userId: tokenData.user_id as string | undefined,
          tenantId: tokenData.tenant_id as string | undefined,
          tokenId: tokenData.id as string | undefined,
          requestId,
        });
        console.warn('[MCP Auth] Insufficient scope:', {
          request_id: requestId,
          client_id: tokenData.client_id,
          user_id: tokenData.user_id,
          tenant_id: tokenData.tenant_id,
          required: options.requiredScopes,
          missing: scopeValidation.missing,
        });
        return {
          error: 'Insufficient scope',
          status: 403,
          wwwAuthenticate: createWWWAuthenticateHeader(
            'insufficient_scope',
            `Missing required scopes: ${scopeValidation.missing?.join(', ')}`,
            tokenData.scopes as string[] | undefined,
            resourceMetadataUrl
          ),
        };
      }
    }

    const expiryDate = new Date(tokenData.expires_at as string);
    const now = new Date();

    if (expiryDate.getTime() < now.getTime()) {
      logOAuthTokenLookup({
        outcome: 'expired',
        clientId: tokenData.client_id as string | undefined,
        userId: tokenData.user_id as string | undefined,
        tenantId: tokenData.tenant_id as string | undefined,
        tokenId: tokenData.id as string | undefined,
        requestId,
      });
      return {
        error: 'Access token has expired',
        status: 401,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'invalid_token',
          'Access token has expired. Reconnect ChatGPT or Claude and authorize again.',
          undefined,
          resourceMetadataUrl
        ),
      };
    }

    // Best-effort last_used_at (never block auth)
    if (tokenData.id) {
  void Promise.resolve(
    supabaseAdmin
      .from('mcp_oauth_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenData.id)
  ).then(
    () => undefined,
    () => undefined
  );
    }

    logOAuthTokenLookup({
      outcome: 'hit',
      clientId: tokenData.client_id as string | undefined,
      userId: tokenData.user_id as string | undefined,
      tenantId: tokenData.tenant_id as string | undefined,
      tokenId: tokenData.id as string | undefined,
      requestId,
    });

    try {
      const { assertTenantMembership } = await import('@/lib/tenant/platformTenant');
      await assertTenantMembership(
        tokenData.tenant_id as string,
        tokenData.user_id as string
      );
    } catch (membershipErr) {
      console.warn('[MCP Auth] Fresh token rejected — inactive membership', {
        request_id: requestId,
        client_id: tokenData.client_id,
        user_id: tokenData.user_id,
        tenant_id: tokenData.tenant_id,
        error: membershipErr instanceof Error ? membershipErr.message : membershipErr,
      });
      return {
        error: 'Unauthorized',
        status: 401,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'invalid_token',
          'Workspace membership is not active',
          undefined,
          resourceMetadataUrl
        ),
      };
    }

    return {
      tenant_id: tokenData.tenant_id as string,
      user_id: tokenData.user_id as string,
      apiKey: token,
      supabaseAdmin,
      resource: (tokenData.resource as string) || PUBLIC_MCP_RESOURCE,
      scope: (tokenData.scopes as string[]) || ['read', 'write'],
      client_id: (tokenData.client_id as string) || undefined,
      token_id: (tokenData.id as string) || undefined,
    };
  }

  // ── 2. Fallback to API Key ───────────────────────────────────────────────
  const keyData = await lookupMcpApiKey(supabaseAdmin, token, { requireActive: true });

  if (!keyData) {
    return {
      error: 'Unauthorized',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader(
        'invalid_token',
        'Invalid API key',
        undefined,
        resourceMetadataUrl
      ),
    };
  }

  if (options?.requiredScopes && options.requiredScopes.length > 0) {
    const scopeValidation = validateScope(keyData.scopes, options.requiredScopes);

    if (!scopeValidation.valid) {
      return {
        error: 'Insufficient scope',
        status: 403,
        wwwAuthenticate: createWWWAuthenticateHeader(
          'insufficient_scope',
          `Missing required scopes: ${scopeValidation.missing?.join(', ')}`,
          keyData.scopes ?? undefined,
          resourceMetadataUrl
        ),
      };
    }
  }

  try {
    const { assertTenantMembership } = await import('@/lib/tenant/platformTenant');
    await assertTenantMembership(keyData.tenant_id, keyData.user_id);
  } catch {
    return {
      error: 'Unauthorized',
      status: 401,
      wwwAuthenticate: createWWWAuthenticateHeader(
        'invalid_token',
        'Workspace membership is not active',
        undefined,
        resourceMetadataUrl
      ),
    };
  }

  return {
    tenant_id: keyData.tenant_id,
    user_id: keyData.user_id,
    apiKey: token,
    supabaseAdmin,
    resource: PUBLIC_MCP_RESOURCE,
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

/** Build typed MCP auth context from a successful AuthResult. */
export function toMCPAuthContext(auth: AuthResult): MCPAuthContext {
  return {
    tokenId: auth.token_id || '',
    clientId: auth.client_id || '',
    userId: auth.user_id,
    tenantId: auth.tenant_id,
    scopes: auth.scope || ['read', 'write'],
    resource: auth.resource || PUBLIC_MCP_RESOURCE,
  };
}

const BLOCKED_MCP_CORS_ORIGINS = new Set([
  'null',
  'file://',
]);

function isAllowedMcpBrowserOrigin(origin: string | null): boolean {
  if (!origin || BLOCKED_MCP_CORS_ORIGINS.has(origin)) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    // Dev localhost only over http
    if (url.protocol === 'http:') {
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    }
    // Any https origin — universal MCP browser clients (ChatGPT, Claude, Cursor, VS Code web, etc.)
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '0.0.0.0' ||
      url.hostname.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version, x-client-label',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version, x-mcp-version, WWW-Authenticate',
  'Access-Control-Max-Age': '86400',
};

export function getMcpCorsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && isAllowedMcpBrowserOrigin(origin)) {
    return {
      ...MCP_CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };
  }

  return {
    ...MCP_CORS_HEADERS,
    'Access-Control-Allow-Origin': '*',
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
 * Creates a standardized Unauthorized / Forbidden response with WWW-Authenticate header
 */
export function createUnauthorizedResponse(
  req: NextRequest,
  error: string = 'invalid_token',
  description?: string,
  scopes?: string[],
  status: 401 | 403 = 401
): NextResponse {
  const resourceMetadataUrl = buildMcpResourceMetadataUrl(req);
  const wwwAuthenticate = createWWWAuthenticateHeader(
    error,
    description,
    scopes,
    resourceMetadataUrl
  );

  return NextResponse.json(
    {
      error,
      error_description: description || 'Authentication required',
    },
    {
      status,
      headers: {
        ...getMcpCorsHeaders(req),
        'WWW-Authenticate': wwwAuthenticate,
        'Cache-Control': 'no-store',
        'MCP-Protocol-Version': '2025-11-25',
      },
    }
  );
}
