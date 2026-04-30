import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';
import { createMCPServer } from '../../../services/mcp/MCPServer';

export const config = {
  api: {
    bodyParser: true,
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

/**
 * Functional MCP SSE endpoint.
 * Supports GET for stream initialization and POST for synchronous JSON-RPC execution.
 * Authenticates via x-api-key header or api_key query parameter.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS Handling
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. Authentication
  const authHeader = req.headers['authorization'];
  let api_key =
    (req.query.api_key as string | undefined) ||
    (req.headers['x-api-key'] as string | undefined);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    api_key = authHeader.substring(7);
  }

  if (!api_key) {
    return res.status(401).json({
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token.',
    });
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  const { data: keyData, error: keyError } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('tenant_id, user_id')
    .eq('api_key', api_key)
    .single();

  if (keyError || !keyData) {
    console.warn('[MCP SSE] Invalid API key attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tenant_id, user_id } = keyData;

  // 2. GET: SSE Handshake
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Standard MCP SSE 'endpoint' event
    // The client will use this URL for subsequent POST messages
    const endpoint = `/api/mcp/sse?api_key=${api_key}`;
    res.write(`event: endpoint\ndata: ${endpoint}\n\n`);
    
    // Update last used timestamp
    await supabaseAdmin
      .from('mcp_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', api_key);

    // Create a session record
    await supabaseAdmin
      .from('mcp_sessions')
      .insert({ tenant_id, user_id, client_label: 'sse-handshake' });

    // Keep connection alive for a bit or until closed by client
    // On Vercel this will eventually time out, but it's enough for the handshake
    return new Promise((resolve) => {
      req.on('close', () => {
        resolve(null);
      });
      
      // Optional: send heartbeats every 15s to keep connection open in some environments
      const heartbeat = setInterval(() => {
        res.write(':\n\n');
      }, 15000);
      
      req.on('close', () => clearInterval(heartbeat));
    });
  }

  // 3. POST: JSON-RPC Message Processing
  if (req.method === 'POST') {
    try {
      const mcpServer = createMCPServer({
        tenantId: tenant_id,
        userId: user_id,
        clientLabel: 'manus-mcp-cli',
      });

      // Process the request synchronously using the server's internal logic
      // This bypasses the need for a persistent transport during this request
      const request = req.body;
      
      if (!request || typeof request !== 'object') {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: null
        });
      }

      // Handle the request directly
      // Note: In MCP SDK, 'server.handleRequest' is the way to process a single request
      const response = await (mcpServer.server as any).handleRequest(request);
      
      return res.status(200).json(response);
    } catch (err) {
      console.error('[MCP SSE POST] Processing failed:', err);
      return res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Internal Server Error', data: String(err) },
        id: req.body?.id || null
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
