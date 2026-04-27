import { NextApiRequest, NextApiResponse } from 'next';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMCPServer } from '../../../services/mcp/MCPServer';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id, x-tenant-id, x-user-id',
};

function getRequestBaseUrl(req: NextApiRequest): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;

  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : typeof protoHeader === 'string' && protoHeader.trim()
      ? protoHeader.split(',')[0].trim()
      : 'https';

  const host = Array.isArray(hostHeader)
    ? hostHeader[0]
    : typeof hostHeader === 'string'
      ? hostHeader
      : '';

  if (host) return `${proto}://${host}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://alphaclonesystems.com';
}

function setOauthAuthenticateHeader(req: NextApiRequest, res: NextApiResponse) {
  const baseUrl = getRequestBaseUrl(req).replace(/\/+$/, '');
  const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
  const resourceUrl = `${baseUrl}/api/mcp/sse`;
  // Include both resource and resource_metadata for broader client compatibility.
  res.setHeader(
    'WWW-Authenticate',
    `Bearer realm="${baseUrl}", resource="${resourceUrl}", resource_metadata="${resourceMetadataUrl}"`
  );
}

function redactApiKey(value: string | undefined): string {
  if (!value) return 'none';
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function detectMcpClientLabel(req: NextApiRequest): string {
  const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  const signals = `${userAgent} ${origin} ${referer}`;
  if (signals.includes('manus')) return 'manus';
  if (signals.includes('claude')) return 'claude';
  if (signals.includes('chatgpt') || signals.includes('openai')) return 'chatgpt';
  return 'unknown';
}

function logAuthDiagnostic(
  phase: 'missing_key' | 'invalid_key' | 'service_unavailable',
  req: NextApiRequest,
  apiKey: string | undefined
) {
  const headerKeys = Object.keys(req.headers);
  console.warn('[MCP SSE] auth diagnostic', {
    phase,
    method: req.method,
    path: req.url,
    api_key_hint: redactApiKey(apiKey),
    has_authorization: Boolean(req.headers['authorization']),
    has_x_api_key: Boolean(req.headers['x-api-key']),
    header_keys: headerKeys,
  });
}

export const config = {
  api: {
    bodyParser: true,
  },
};

function pickQueryOrHeader(
  req: NextApiRequest,
  key: 'tenant_id' | 'user_id'
): string | undefined {
  const q = req.query[key];
  if (typeof q === 'string' && q.trim()) return q.trim();
  const headerName = key === 'tenant_id' ? 'x-tenant-id' : 'x-user-id';
  const h = req.headers[headerName];
  if (typeof h === 'string' && h.trim()) return h.trim();
  if (Array.isArray(h) && h[0]) return String(h[0]).trim();
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const authHeader = req.headers['authorization'];
  let api_key =
    (req.query.api_key as string | undefined) ||
    (req.headers['x-api-key'] as string | undefined);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    api_key = authHeader.substring(7);
  }

  // A reachability probe is a GET/HEAD with no credentials at all.
  // A GET that carries a key is an authenticated SSE stream request and must
  // receive a real auth response, not a silent 200.
  const hasCredentials = Boolean(api_key);
  const isReachabilityProbe = !hasCredentials && (req.method === 'GET' || req.method === 'HEAD');

  if (!api_key) {
    logAuthDiagnostic('missing_key', req, undefined);
    if (isReachabilityProbe) {
      return res.status(200).json({
        ok: true,
        auth_required: true,
        endpoint: '/api/mcp/sse',
        message: 'MCP endpoint reachable. Provide x-api-key or Authorization Bearer token for authenticated sessions.',
      });
    }
    setOauthAuthenticateHeader(req, res);
    return res.status(401).json({
      error:
        'Connection could not be verified. Open your workspace MCP settings, copy a fresh connection key, and try again.',
    });
  }

  const urlTenantId = pickQueryOrHeader(req, 'tenant_id');
  const urlUserId = pickQueryOrHeader(req, 'user_id');

  let tenantId: string | null = null;
  let userId: string | null = null;
  let authError: string | null = null;
  let authorizedScopes: string[] = [];
  console.log('[MCP SSE] start auth lookup', { 
    has_api_key: Boolean(api_key), 
    key_prefix: api_key?.substring(0, 7),
    method: req.method
  });


  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { ENV } = await import('../../../config/env');

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[MCP SSE] Server configuration incomplete');
      throw new Error('SERVICE_UNAVAILABLE');
    }

    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    if (api_key.startsWith('mcp_at_')) {
      const { data, error } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .select('tenant_id, user_id, scopes, expires_at')
        .eq('access_token', api_key)
        .single();

      if (error || !data || new Date(data.expires_at) < new Date()) {
        authError = 'invalid';
      } else {
        tenantId = data.tenant_id;
        userId = data.user_id;
        authorizedScopes = data.scopes;
        console.log('[MCP SSE] OAuth token valid', { 
          tenantId, 
          userId, 
          scopes: authorizedScopes 
        });
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('mcp_api_keys')
        .select('tenant_id, user_id')
        .eq('api_key', api_key)
        .single();

      if (error || !data) {
        authError = 'invalid';
      } else {
        tenantId = data.tenant_id;
        userId = data.user_id;
        authorizedScopes = ['*'];

        supabaseAdmin
          .from('mcp_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('api_key', api_key)
          .then();
      }
    }
  } catch (err) {
    console.error('[MCP SSE] Auth lookup failed:', err);
    authError = 'SERVICE_UNAVAILABLE';
  }

  if (authError || !tenantId || !userId) {
    logAuthDiagnostic(
      authError === 'SERVICE_UNAVAILABLE' ? 'service_unavailable' : 'invalid_key',
      req,
      api_key
    );
    console.log('[MCP SSE] Auth failed', { authError, tenantId, userId });
    if (isReachabilityProbe) {
      return res.status(200).json({
        ok: true,
        auth_required: true,
        endpoint: '/api/mcp/sse',
        message: 'MCP endpoint reachable. Authentication required for active sessions.',
      });
    }
    const msg =
      authError === 'SERVICE_UNAVAILABLE'
        ? 'The service is temporarily unavailable. Please try again in a few minutes.'
        : 'Connection could not be verified. Open your workspace MCP settings, generate a fresh connection key, and try again.';
    setOauthAuthenticateHeader(req, res);
    return res.status(401).json({ error: msg });
  }

  if (urlTenantId && urlTenantId !== tenantId) {
    return res.status(403).json({
      error: 'This connection does not match the workspace in your request. Use the MCP URL from your dashboard.',
    });
  }
  if (urlUserId && urlUserId !== userId) {
    return res.status(403).json({
      error: 'This connection does not match the user in your request. Use the MCP URL from your dashboard.',
    });
  }

  void authorizedScopes;

  const mcpServer = createMCPServer({ tenantId, userId, clientLabel: detectMcpClientLabel(req) });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const isGetTransport = req.method === 'GET';
  const heartbeatMs = 15000;
  let heartbeat: NodeJS.Timeout | null = null;

  if (isGetTransport) {
    heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          // Ignore write errors; cleanup happens on close/finish.
        }
      }
    }, heartbeatMs);
  }

  const stopHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };
  res.once('close', stopHeartbeat);
  res.once('finish', stopHeartbeat);

  try {
    await mcpServer.server.connect(transport);
    await transport.handleRequest(req as any, res as any, req.body);
  } finally {
    stopHeartbeat();
  }
}
