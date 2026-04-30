import { NextApiRequest, NextApiResponse } from 'next';
import { validateMCPAuth, handleCors } from '../../../services/mcp/authMiddleware';
import { createMCPServer } from '../../../services/mcp/MCPServer';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return;

  const auth = await validateMCPAuth(req, res);
  if (!auth) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const mcpServer = createMCPServer({
      tenantId: auth.tenant_id,
      userId: auth.user_id,
      clientLabel: 'discovery-tool',
    });

    // Manually trigger the list tools handler
    const handlers = (mcpServer.server as any)._requestHandlers;
    const handler = handlers ? handlers.get('tools/list') : null;

    if (!handler) {
      return res.status(500).json({ error: 'Tools handler not initialized' });
    }

    const result = await handler({});
    res.setHeader('X-MCP-Version', '2.0.0');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[MCP Tools] Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
