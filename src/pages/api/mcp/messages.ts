import { NextApiRequest, NextApiResponse } from 'next';
import { createMCPServer } from '../../../services/mcp/MCPServer';
import { handleCors, validateMCPAuth } from '../../../services/mcp/authMiddleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return;

  const auth = await validateMCPAuth(req, res);
  if (!auth) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { tenant_id, user_id } = auth;

  try {
    res.setHeader('X-MCP-Version', '2.0.0');
    const mcpServer = createMCPServer({
      tenantId: tenant_id,
      userId: user_id,
      clientLabel: req.headers['x-client-label'] as string || 'mcp-client',
    });

    let request = req.body;
    if (typeof request === 'string') {
      try {
        request = JSON.parse(request);
      } catch (e) {
        console.error('[MCP Messages POST] Body parse failed:', e);
      }
    }
    
    if (!request || typeof request !== 'object' || !request.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: request?.id || null
      });
    }

    const method = request.method;
    const handlers = (mcpServer.server as any)._requestHandlers;
    const handler = handlers ? handlers.get(method) : null;

    if (!handler) {
      return res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
        id: request.id || null
      });
    }

    const result = await handler(request);
    
    return res.status(200).json({
      jsonrpc: '2.0',
      id: request.id,
      result
    });

  } catch (err) {
    console.error('[MCP Messages POST] Execution failed:', err);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal Server Error' },
      id: req.body?.id || null
    });
  }
}
