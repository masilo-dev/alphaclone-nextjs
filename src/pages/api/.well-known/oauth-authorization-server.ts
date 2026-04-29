import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    issuer: 'https://www.alphaclonesystems.com',
    authorization_endpoint: 'https://www.alphaclonesystems.com/oauth/authorize',
    token_endpoint: 'https://www.alphaclonesystems.com/oauth/token'
  });
}
