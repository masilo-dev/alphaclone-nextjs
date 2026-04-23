import type { NextApiRequest, NextApiResponse } from 'next';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id, x-tenant-id, x-user-id',
};

type HealthResponse = {
  ok: boolean;
  service: 'mcp';
  endpoint: string;
  timestamp: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse | { ok: false; error: string }>) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    service: 'mcp',
    endpoint: '/api/mcp/sse',
    timestamp: new Date().toISOString(),
  });
}
