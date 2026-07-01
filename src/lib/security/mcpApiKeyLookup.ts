import type { SupabaseClient } from '@supabase/supabase-js';
import { hashMcpApiKey } from '@/lib/security/mcpKeyHash';

export type McpKeyRecord = {
  tenant_id: string;
  user_id: string;
  scopes?: string[] | null;
};

export async function lookupMcpApiKey(
  admin: SupabaseClient,
  token: string
): Promise<McpKeyRecord | null> {
  const keyHash = hashMcpApiKey(token);

  const { data: byHash } = await admin
    .from('mcp_api_keys')
    .select('tenant_id, user_id, scopes')
    .eq('api_key_hash', keyHash)
    .maybeSingle();

  if (byHash) return byHash as McpKeyRecord;

  const { data: byPlain } = await admin
    .from('mcp_api_keys')
    .select('tenant_id, user_id, scopes, id')
    .eq('api_key', token)
    .maybeSingle();

  if (!byPlain) return null;

  await admin
    .from('mcp_api_keys')
    .update({ api_key_hash: keyHash, api_key: null, updated_at: new Date().toISOString() })
    .eq('id', byPlain.id);

  return byPlain as McpKeyRecord;
}

export async function touchMcpApiKeyLastUsed(
  admin: SupabaseClient,
  token: string,
  _tenantId: string,
  _userId: string
): Promise<void> {
  const keyHash = hashMcpApiKey(token);
  await admin
    .from('mcp_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key_hash', keyHash);
}
