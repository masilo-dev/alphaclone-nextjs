import { NextApiRequest, NextApiResponse } from 'next';
import { createMCPServer } from '../../../services/mcp/MCPServer';
import { handleCors, validateMCPAuth } from '../../../services/mcp/authMiddleware';

export const config = {
  api: {
    bodyParser: true,
  },
};


/**
 * Functional MCP SSE endpoint.
 * Supports GET for stream initialization and POST for synchronous JSON-RPC execution.
 * Authenticates via x-api-key header or api_key query parameter.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return;

  const auth = await validateMCPAuth(req, res);
  if (!auth) return;

  const { tenant_id, user_id, apiKey, supabaseAdmin } = auth;

  // 2. GET: SSE Handshake
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevent Vercel/Nginx buffering
    res.setHeader('X-MCP-Version', '2.0.0');
    
    // Standard MCP SSE 'endpoint' event
    // We send an absolute URL and include the api_key to ensure subsequent POSTs are authorized.
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
      .insert({ tenant_id, user_id, client_label: 'sse-handshake' });

    // Keep connection alive
    return new Promise((resolve) => {
      req.on('close', () => {
        resolve(null);
      });
      
      const heartbeat = setInterval(() => {
        res.write(':\n\n');
      }, 15000);
      
      req.on('close', () => clearInterval(heartbeat));
    });
  }

  // 3. POST: Stateless Synchronous Execution (fallback/unified endpoint)
  if (req.method === 'POST') {
    try {
      const mcpServer = createMCPServer({
        tenantId: tenant_id,
        userId: user_id,
        clientLabel: req.headers['x-client-label'] as string || 'mcp-sse-post',
      });

      let requestBody = req.body;
      if (typeof requestBody === 'string') {
        try {
          requestBody = JSON.parse(requestBody);
        } catch (e) {
          console.error('[MCP SSE POST] Body parse failed:', e);
        }
      }
      
      if (!requestBody || typeof requestBody !== 'object' || !requestBody.method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: requestBody?.id || null
        });
      }

      const method = requestBody.method;
      const handlers = (mcpServer.server as any)._requestHandlers;
      const handler = handlers ? handlers.get(method) : null;

      if (!handler) {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${method}` },
          id: requestBody.id || null
        });
      }

      const result = await handler(requestBody);
      
      return res.status(200).json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result
      });
    } catch (err) {
      console.error('[MCP SSE POST] Execution failed:', err);
      return res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal Server Error' },
        id: req.body?.id || null
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
