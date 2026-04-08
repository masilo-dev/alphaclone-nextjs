import { NextApiRequest, NextApiResponse } from 'next';
import { mcpTransports } from '../../../services/mcp/mcpStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  await transport.handlePostMessage(req as any, res as any);
}
