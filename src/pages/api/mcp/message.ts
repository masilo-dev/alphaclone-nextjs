import { NextApiRequest, NextApiResponse } from 'next';
import { mcpTransports } from '../../../services/mcp/mcpStore';

export const config = {
  api: {
    bodyParser: false,
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const sessionId = (req.query.sessionId as string) || (req.headers['mcp-session-id'] as string);

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  const transport = mcpTransports.get(sessionId);

  if (!transport) {
    console.warn('[MCP Message] Session not found', { sessionId });
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // SSEServerTransport has a handlePostMessage method to process the incoming JSON-RPC call.
    if (typeof transport.handlePostMessage === 'function') {
      await transport.handlePostMessage(req, res);
    } else {
      console.error('[MCP Message] Transport does not support handlePostMessage', { sessionId });
      res.status(500).json({ error: 'Transport mismatch' });
    }
  } catch (err) {
    console.error('[MCP Message] Failed to handle message', { sessionId, error: err });
    if (!res.writableEnded) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

