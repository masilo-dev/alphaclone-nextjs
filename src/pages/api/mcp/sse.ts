import { NextApiRequest, NextApiResponse } from 'next';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMCPServer } from '../../../services/mcp/MCPServer';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id',
};

// Disable Next.js body parser — StreamableHTTPServerTransport reads the body itself
// but we pass req.body (pre-parsed) so this is fine either way; keeping it on avoids
// issues with empty-body GET/DELETE requests.
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight — required for Claude.ai and Manus web clients
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const api_key =
    (req.query.api_key as string | undefined) ||
    (req.headers['x-api-key'] as string | undefined);

  if (!api_key) {
    return res.status(401).json({ error: 'Missing MCP connection token. Pass ?api_key=<token> or x-api-key header.' });
  }

  // Use the admin client to bypass RLS since the incoming request is unauthenticated (from Claude/Manus)
  let tenantId: string | null = null;
  let authError: string | null = null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { ENV } = await import('../../../config/env');
    
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabaseAdmin
      .from('mcp_api_keys')
      .select('tenant_id')
      .eq('api_key', api_key)
      .single();

    if (error || !data) {
      authError = 'Invalid or expired MCP connection token';
    } else {
      tenantId = data.tenant_id;
      // Update last_used_at asynchronously
      supabaseAdmin
        .from('mcp_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('api_key', api_key)
        .then();
    }
  } catch (err) {
    authError = String(err);
  }

  if (authError || !tenantId) {
    return res.status(401).json({ error: authError || 'Invalid MCP connection token' });
  }

  // Create a fresh server + stateless transport per request.
  // Stateless mode (sessionIdGenerator: undefined) means no server-side session state is
  // required — each request carries the full JSON-RPC message and gets a complete response.
  // This is compatible with both Claude.ai remote MCP and Manus AI.
  const mcpServer = createMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.server.connect(transport);

  // Pass req.body so the transport doesn't need to re-read the already-parsed body stream
  await transport.handleRequest(req as any, res as any, req.body);
}
