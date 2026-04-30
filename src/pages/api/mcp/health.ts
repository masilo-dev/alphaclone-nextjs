import type { NextApiRequest, NextApiResponse } from 'next';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version, x-tenant-id, x-user-id',
};

type HealthResponse = {
  ok: boolean;
  service: 'mcp';
  transport: 'streamable-http';
  protocol_version: string;
  endpoint: string;
  timestamp: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse | { ok: false; error: string }>) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('MCP-Protocol-Version', '2024-11-05');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    service: 'mcp',
    transport: 'streamable-http',
    protocol_version: '2024-11-05',
    endpoint: '/api/mcp/sse',
    timestamp: new Date().toISOString(),
  });
}
