import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';

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

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  try {
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

  // Create a stateless session record
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('mcp_sessions')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    console.error('[MCP SSE] Failed to create session:', sessionError);
    return res.status(500).json({ error: 'Failed to initialize MCP session' });
  }

  const sessionId = session.id;

  // Set up SSE stream
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');

  // 1. Send the handshake endpoint event
  // Use an absolute URL to ensure remote clients (Claude.ai, Manus) resolve it correctly.
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'];
  const absoluteMessageUrl = `${protocol}://${host}/api/mcp/message?sessionId=${sessionId}`;
  
  res.write(`event: endpoint\ndata: ${absoluteMessageUrl}\n\n`);

  // 2. Subscribe to messages for this session
  const channel = supabaseAdmin
    .channel(`mcp_messages:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mcp_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        if (payload.new && payload.new.content) {
          res.write(`event: message\ndata: ${JSON.stringify(payload.new.content)}\n\n`);
        }
      }
    )
    .subscribe();

  // 3. Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeat);
    supabaseAdmin.removeChannel(channel);
    supabaseAdmin.from('mcp_sessions').delete().eq('id', sessionId).then();
    console.log('[MCP SSE] Session cleaned up', { sessionId });
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
}

