import { NextApiRequest, NextApiResponse } from 'next';
import { createMCPServer } from '../../../services/mcp/MCPServer';
import { handleCors, validateMCPAuth, CORS_HEADERS } from '../../../services/mcp/authMiddleware';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';

export const config = {
  api: {
    bodyParser: true,
  },
};

const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * AlphaClone MCP Endpoint — Streamable HTTP Transport (MCP spec 2025-06-18)
 *
 * Flow (new Streamable HTTP — used by Claude.ai):
 *   1. POST initialize  → returns InitializeResult + Mcp-Session-Id header
 *   2. POST tools/list  → returns tool manifest (auth: api_key OR Mcp-Session-Id)
 *   3. POST tools/call  → executes tool (auth: api_key OR Mcp-Session-Id)
 *
 * Flow (legacy HTTP+SSE — backwards compat):
 *   1. GET              → opens SSE stream, emits endpoint event
 *   2. POST to endpoint → stateless JSON-RPC execution
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // ── GET: Legacy SSE Handshake (backwards compat) ──────────────────────────
  if (req.method === 'GET') {
    const auth = await validateMCPAuth(req, res);
    if (!auth) return;

    const { tenant_id, user_id, apiKey, supabaseAdmin } = auth;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);

    // Absolute URL with embedded api_key so subsequent POSTs are always authorized
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const endpointUrl = `${protocol}://${host}/api/mcp/messages?api_key=${encodeURIComponent(apiKey)}`;
    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    // Update last used timestamp
    await supabaseAdmin
      .from('mcp_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', apiKey);

    // Create a session record
    await supabaseAdmin
      .from('mcp_sessions')
      .insert({ tenant_id, user_id, metadata: { client_label: 'sse-handshake' } });

    // Keep connection alive with heartbeats
    return new Promise((resolve) => {
      const heartbeat = setInterval(() => {
        try { res.write(':\n\n'); } catch { clearInterval(heartbeat); resolve(null); }
      }, 15000);
      req.on('close', () => { clearInterval(heartbeat); resolve(null); });
    });
  }

  // ── POST: Streamable HTTP Transport ──────────────────────────────────────
  if (req.method === 'POST') {
    // Set CORS headers for the response
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);

    let requestBody = req.body;
    if (typeof requestBody === 'string') {
      try { requestBody = JSON.parse(requestBody); } catch { /* ignore */ }
    }

    if (!requestBody || typeof requestBody !== 'object' || !requestBody.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request: missing method' },
        id: requestBody?.id ?? null,
      });
    }

    const method: string = requestBody.method;

    // ── Special case: initialize ─────────────────────────────────────────
    // Claude.ai sends this first — authenticate via api_key query param.
    // Do NOT require Mcp-Session-Id (it doesn't exist yet at this stage).
    if (method === 'initialize') {
      const auth = await validateMCPAuth(req, res);
      if (!auth) return;

      const { tenant_id, user_id, supabaseAdmin } = auth;

      // Create a session with a known UUID
      const { data: sessionRow } = await supabaseAdmin
        .from('mcp_sessions')
        .insert({
          tenant_id,
          user_id,
          metadata: {
            client_label: requestBody.params?.clientInfo?.name || 'claude',
            protocol_version: requestBody.params?.protocolVersion || MCP_PROTOCOL_VERSION,
          },
        })
        .select('id')
        .single();

      const sessionId = sessionRow?.id;
      if (sessionId) {
        res.setHeader('Mcp-Session-Id', sessionId);
      }

      return res.status(200).json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: 'AlphaClone-MCP',
            version: '2.0.0',
          },
        },
      });
    }

    // ── All other methods: authenticate via Mcp-Session-Id OR api_key ────
    const mcpSessionId = req.headers['mcp-session-id'] as string | undefined;

    let tenantId: string;
    let userId: string;

    if (mcpSessionId) {
      // Validate via session lookup
      if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
      }
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('mcp_sessions')
        .select('tenant_id, user_id, expires_at')
        .eq('id', mcpSessionId)
        .single();

      if (sessionError || !session) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found. Send a new initialize request.' },
          id: requestBody.id ?? null,
        });
      }

      if (new Date(session.expires_at) < new Date()) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session expired. Send a new initialize request.' },
          id: requestBody.id ?? null,
        });
      }

      tenantId = session.tenant_id;
      userId = session.user_id;
    } else {
      // Fall back to api_key auth (query param / header)
      const auth = await validateMCPAuth(req, res);
      if (!auth) return;
      tenantId = auth.tenant_id;
      userId = auth.user_id;
    }

    // ── Execute the requested MCP method ────────────────────────────────
    try {
      const mcpServer = createMCPServer({
        tenantId,
        userId,
        clientLabel: (req.headers['x-client-label'] as string) || 'mcp-client',
      });

      const handlers = (mcpServer.server as any)._requestHandlers;
      const methodHandler = handlers ? handlers.get(method) : null;

      if (!methodHandler) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${method}` },
          id: requestBody.id ?? null,
        });
      }

      const result = await methodHandler(requestBody);

      return res.status(200).json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result,
      });
    } catch (err) {
      console.error('[MCP SSE POST] Execution failed:', err);
      return res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal Server Error' },
        id: requestBody?.id ?? null,
      });
    }
  }

  // ── DELETE: Session termination ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    const mcpSessionId = req.headers['mcp-session-id'] as string | undefined;
    if (mcpSessionId && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      await supabaseAdmin.from('mcp_sessions').delete().eq('id', mcpSessionId);
    }
    return res.status(200).end();
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
