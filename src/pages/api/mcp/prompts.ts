import { NextApiRequest, NextApiResponse } from 'next';
import { validateMCPAuth, handleCors } from '../../../services/mcp/authMiddleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return;

  const auth = await validateMCPAuth(req, res);
  if (!auth) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('X-MCP-Version', '2.0.0');
  return res.status(200).json({
    prompts: [],
    nextCursor: null
  });
}
