import { NextApiRequest, NextApiResponse } from 'next';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMCPServer } from '../../../services/mcp/MCPServer';
import { mcpTransports } from '../../../services/mcp/mcpStore';

export const config = {
  api: {
    bodyParser: false,
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const authHeader = req.headers['authorization'];
  let api_key =
    (req.query.api_key as string | undefined) ||
    (req.headers['x-api-key'] as string | undefined);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    api_key = authHeader.substring(7);
  }

  if (!api_key) {
    return res.status(401).json({
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token.',
    });
  }

  const urlTenantId = pickQueryOrHeader(req, 'tenant_id');
  const urlUserId = pickQueryOrHeader(req, 'user_id');

  let tenantId: string | null = null;
  let userId: string | null = null;
  let authError: string | null = null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { ENV } = await import('../../../config/env');

    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SERVICE_UNAVAILABLE');
    }

    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

    if (api_key.startsWith('mcp_at_')) {
      const { data, error } = await supabaseAdmin
        .from('mcp_oauth_tokens')
        .select('tenant_id, user_id, expires_at')
        .eq('access_token', api_key)
        .single();

      if (error || !data || new Date(data.expires_at) < new Date()) {
        authError = 'invalid';
      } else {
        tenantId = data.tenant_id;
        userId = data.user_id;
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
        
        supabaseAdmin
          .from('mcp_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('api_key', api_key)
          .then();
      }
    }
  } catch (err) {
    console.error('[MCP SSE] Auth failed:', err);
    authError = 'SERVICE_UNAVAILABLE';
  }

  if (authError || !tenantId || !userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (urlTenantId && urlTenantId !== tenantId) {
    return res.status(403).json({ error: 'Workspace mismatch' });
  }

  // SSEServerTransport handles the SSE stream lifecycle.
  // It expects the message endpoint URL as the first argument.
  const transport = new SSEServerTransport('/api/mcp/message', res);
  
  console.log('[MCP SSE] New session', {
    sessionId: transport.sessionId,
    tenantId,
    userId,
    client: detectMcpClientLabel(req)
  });

  mcpTransports.set(transport.sessionId, transport);

  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');

  res.on('close', () => {
    console.log('[MCP SSE] Session closed', { sessionId: transport.sessionId });
    mcpTransports.delete(transport.sessionId);
    // Note: SSEServerTransport might not have a close() in all versions, 
    // but we remove it from our store to prevent leaks.
  });

  const mcpServer = createMCPServer({ 
    tenantId, 
    userId, 
    clientLabel: detectMcpClientLabel(req) 
  });

  await mcpServer.server.connect(transport);
}

