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

  const { tenant_id, user_id, supabaseAdmin } = auth;
  const api_key = (req.headers['authorization']?.substring(7)) || (req.headers['x-api-key'] as string);

  // 2. GET: SSE Handshake
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-MCP-Version', '2.0.0');
    
    // Standard MCP SSE 'endpoint' event
    // We send the dedicated message handling URL.
    const endpoint = `/api/mcp/messages`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);
    
    // Update last used timestamp
    await supabaseAdmin
      .from('mcp_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', api_key);

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

  return res.status(405).json({ error: 'Method Not Allowed' });
}
