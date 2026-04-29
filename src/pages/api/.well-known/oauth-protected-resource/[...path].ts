import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    resource: 'https://www.alphaclonesystems.com/api/mcp/sse',
    authorization_servers: ['https://www.alphaclonesystems.com']
  });
}
