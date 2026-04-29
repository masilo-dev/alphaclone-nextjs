import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';
import { createMCPServer } from '../../../services/mcp/MCPServer';

export const config = {
  api: {
    bodyParser: true,
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-tenant-id, x-user-id',
};

// Transport for processing POST messages inline
class InlineTransport {
  onmessage?: (message: any) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  private response?: any;
  private resolve?: (val: any) => void;

  async start() {}
  async close() { this.onclose?.(); }
  async send(message: any) {
    this.response = message;
    if (this.resolve) this.resolve(message);
  }
  
  async handle(message: any): Promise<any> {
    if (!this.onmessage) throw new Error('Transport not connected');
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.onmessage!(message);
    });
  }
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

  if (req.method !== 'GET' && req.method !== 'POST') {
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

  // Set up SSE headers
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');

  if (req.method === 'POST') {
    // New Streamable HTTP transport: process message inline
    try {
      const message = req.body;
      if (!message) {
        return res.status(400).end();
      }

      const mcpServer = createMCPServer({
        tenantId,
        userId,
        clientLabel: 'claude-http',
      });

      const transport = new InlineTransport();
      await mcpServer.server.connect(transport);
      
      const response = await transport.handle(message);
      
      // Send the response back as an SSE message event
      res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
      res.end();
      
      // Cleanup session record (stateless for POST)
      await supabaseAdmin.from('mcp_sessions').delete().eq('id', sessionId);
      return;
    } catch (err) {
      console.error('[MCP SSE] POST processing failed:', err);
      return res.status(500).end();
    }
  }

  // GET: Existing SSE stream logic
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'];
  const absoluteMessageUrl = `${protocol}://${host}/api/mcp/message?sessionId=${sessionId}`;
  
  res.write(`event: endpoint\ndata: ${absoluteMessageUrl}\n\n`);

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

