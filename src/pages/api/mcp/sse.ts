import { NextApiRequest, NextApiResponse } from 'next';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { mcpServerInstance } from '../../../services/mcp/MCPServer';
import { mcpTransports } from '../../../services/mcp/mcpStore';
import { MCPAuthService } from '../../../services/mcp/MCPAuthService';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight (required for Claude.ai and Manus web clients)
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { api_key } = req.query;

  if (!api_key || typeof api_key !== 'string') {
    return res.status(401).json({ error: 'Missing MCP connection token' });
  }

  // Validate the token and get tenant context
  const { tenantId, error: authError } = await MCPAuthService.validateToken(api_key);
  
  if (authError || !tenantId) {
    return res.status(401).json({ error: authError || 'Invalid MCP connection token' });
  }

  // Create SSE transport directed to the generic message endpoint
  const transport = new SSEServerTransport('/api/mcp/message', res as any);
  
  await mcpServerInstance.server.connect(transport);

  // Store the transport so POST messages can route to it
  mcpTransports.set(transport.sessionId, transport);

  // Clean up when the connection is closed
  res.on('close', () => {
    mcpTransports.delete(transport.sessionId);
  });
}
