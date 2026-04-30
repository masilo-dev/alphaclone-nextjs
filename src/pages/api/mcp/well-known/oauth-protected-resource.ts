import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * GET /.well-known/oauth-protected-resource
 *
 * Claude.ai fetches this first to discover where to obtain access tokens.
 * Without this, Claude bails before even attempting to connect.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.alphaclonesystems.com';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${host}`;

  return res.status(200).json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header', 'query'],
    resource_documentation: `${baseUrl}/api/mcp/health`,
    scopes_supported: ['read', 'write', 'mcp:tools', 'mcp:resources'],
  });
}
