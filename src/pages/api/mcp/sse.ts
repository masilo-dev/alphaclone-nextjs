import { NextApiRequest, NextApiResponse } from 'next';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMCPServer } from '../../../services/mcp/MCPServer';
import { MCPAuthService } from '../../../services/mcp/MCPAuthService';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id',
};

// Disable Next.js body parser — StreamableHTTPServerTransport reads the body itself
// but we pass req.body (pre-parsed) so this is fine either way; keeping it on avoids
// issues with empty-body GET/DELETE requests.
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight — required for Claude.ai and Manus web clients
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Auth: accept api_key as ?api_key= query param or x-api-key header
  const api_key =
    (req.query.api_key as string | undefined) ||
    (req.headers['x-api-key'] as string | undefined);

  if (!api_key) {
    return res.status(401).json({ error: 'Missing MCP connection token. Pass ?api_key=<token> or x-api-key header.' });
  }

  const { tenantId, error: authError } = await MCPAuthService.validateToken(api_key);

  if (authError || !tenantId) {
    return res.status(401).json({ error: authError || 'Invalid MCP connection token' });
  }

  // Create a fresh server + stateless transport per request.
  // Stateless mode (sessionIdGenerator: undefined) means no server-side session state is
  // required — each request carries the full JSON-RPC message and gets a complete response.
  // This is compatible with both Claude.ai remote MCP and Manus AI.
  const mcpServer = createMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.server.connect(transport);

  // Pass req.body so the transport doesn't need to re-read the already-parsed body stream
  await transport.handleRequest(req as any, res as any, req.body);
}
