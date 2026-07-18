import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { hashMcpApiKey } from '@/lib/security/mcpKeyHash';

export async function validateMCPAuth(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers['authorization'];
  let api_key = (req.headers['x-api-key'] as string) || (req.query.api_key as string);

  if (!api_key && authHeader && authHeader.startsWith('Bearer ')) {
    api_key = authHeader.substring(7);
  }

  if (!api_key) {
    res.status(401).json({
      error: 'Authentication required. Provide x-api-key or Authorization Bearer token header.',
    });
    return null;
  }

  if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
    return null;
  }

  const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);

  const { data: keyData, error: keyError } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('tenant_id, user_id')
    .eq('api_key_hash', hashMcpApiKey(api_key))
    .eq('is_active', true)
    .single();

  if (keyError || !keyData) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  return {
    tenant_id: keyData.tenant_id,
    user_id: keyData.user_id,
    apiKey: api_key, // Return the key used for auth
    supabaseAdmin,
  };
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Mcp-Session-Id, MCP-Protocol-Version',
};

export function handleCors(req: NextApiRequest, res: NextApiResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
