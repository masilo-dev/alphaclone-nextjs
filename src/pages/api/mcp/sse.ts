import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../../config/env';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-tenant-id, x-user-id',
};

function pickQueryOrHeader(
  req: NextApiRequest,
  key: 'tenant_id' | 'user_id'
): string | undefined {
  const q = req.query[key];
  if (typeof q === 'string' && q.trim()) return q.trim();
  const headerName = key === 'tenant_id' ? 'x-tenant-id' : 'x-user-id';
  const h = req.headers[headerName];
  if (typeof h === 'string' && h.trim()) return h.trim();
  if (Array.isArray(h) && h[0]) return String(h[0]).trim();
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

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

  const urlTenantId = pickQueryOrHeader(req, 'tenant_id');
  const urlUserId = pickQueryOrHeader(req, 'user_id');

  let tenantId: string | null = null;
  let userId: string | null = null;
  let authError: string | null = null;

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabaseAdmin
      .from('mcp_api_keys')
      .select('tenant_id, user_id')
      .eq('api_key', api_key)
      .single();

    if (error || !data) {
      authError = 'invalid';
    } else {
      tenantId = data.tenant_id;
      userId = data.user_id;

      supabaseAdmin
        .from('mcp_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('api_key', api_key)
        .then(({ error }) => {
          if (error) console.error('[MCP] Update last_used_at failed:', error);
        });
    }
  } catch (err) {
    console.error('[MCP] Auth failed:', err);
    authError = 'SERVICE_UNAVAILABLE';
  }

  if (authError || !tenantId || !userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (urlTenantId && urlTenantId !== tenantId) {
    return res.status(403).json({ error: 'Workspace mismatch' });
  }

  // Fire and forget session logging
  supabaseAdmin
    .from('mcp_sessions')
    .insert({ tenant_id: tenantId, user_id: userId })
    .then(({ error }) => {
      if (error) console.error('[MCP] Session log failed:', error);
    });

  const { jsonrpc, method, params, id } = req.body || {};

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request' }
    });
  }

  let result: any = null;
  let error: any = null;

  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "AlphaClone MCP", version: "1.0.0" }
      };
      break;
    
    case 'tools/list':
      result = { tools: [] };
      break;

    case 'ping':
      result = {};
      break;

    case 'notifications/initialized':
      // Client acknowledgment of initialization
      return res.status(204).end();

    default:
      error = { code: -32601, message: 'Method not found' };
      break;
  }

  const response: any = { jsonrpc: '2.0', id: id || null };
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }

  return res.status(200).json(response);
}
