import { NextApiRequest, NextApiResponse } from 'next';
import { mcpTransports } from '../../../services/mcp/mcpStore';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { sessionId } = req.query;

  if (typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid sessionId' });
  }

  const transport = mcpTransports.get(sessionId);

  if (!transport) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (typeof transport.handlePostMessage === 'function') {
    await transport.handlePostMessage(req as any, res as any);
    return;
  }

  if (typeof transport.handleRequest === 'function') {
    await transport.handleRequest(req as any, res as any, req.body);
    return;
  }

  return res.status(500).json({ error: 'MCP transport session is invalid' });
}
