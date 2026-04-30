import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';
import { createMCPServer } from '../../../services/mcp/MCPServer';
import { handleCors, validateMCPAuth, CORS_HEADERS } from '../../../services/mcp/authMiddleware';

const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * Legacy HTTP+SSE message handler.
 * Called by the client after receiving the endpoint URL from the SSE stream.
 * Also supports Mcp-Session-Id from the new Streamable HTTP transport.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);

  let tenantId: string;
  let userId: string;

  // Auth: Mcp-Session-Id takes priority, then api_key
  const mcpSessionId = req.headers['mcp-session-id'] as string | undefined;

  if (mcpSessionId) {
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
    }
    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    const { data: session, error } = await supabaseAdmin
      .from('mcp_sessions')
      .select('tenant_id, user_id, expires_at')
      .eq('id', mcpSessionId)
      .single();

    if (error || !session) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found. Send a new initialize request.' },
        id: null,
      });
    }
    if (new Date(session.expires_at) < new Date()) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session expired. Send a new initialize request.' },
        id: null,
      });
    }
    tenantId = session.tenant_id;
    userId = session.user_id;
  } else {
    const auth = await validateMCPAuth(req, res);
    if (!auth) return;
    tenantId = auth.tenant_id;
    userId = auth.user_id;
  }

  let request = req.body;
  if (typeof request === 'string') {
    try { request = JSON.parse(request); } catch { /* ignore */ }
  }

  if (!request || typeof request !== 'object' || !request.method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: request?.id ?? null,
    });
  }

  try {
    const mcpServer = createMCPServer({
      tenantId,
      userId,
      clientLabel: (req.headers['x-client-label'] as string) || 'mcp-client',
    });

    const method = request.method;
    const handlers = (mcpServer.server as any)._requestHandlers;
    const methodHandler = handlers ? handlers.get(method) : null;

    if (!methodHandler) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
        id: request.id ?? null,
      });
    }

    const result = await methodHandler(request);

    return res.status(200).json({
      jsonrpc: '2.0',
      id: request.id,
      result,
    });
  } catch (err) {
    console.error('[MCP Messages POST] Execution failed:', err);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal Server Error' },
      id: request?.id ?? null,
    });
  }
}
