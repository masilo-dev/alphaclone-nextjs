import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  res.status(201).json({
    client_id: 'alphaclone-mcp-client',
    client_secret: 'not-used',
    registration_access_token: 'not-used',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: 'none',
  });
}
