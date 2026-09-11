import type { SupabaseClient } from '@supabase/supabase-js';
import { hashMcpApiKey } from '@/lib/security/mcpKeyHash';

export type McpKeyRecord = {
  tenant_id: string;
  user_id: string;
  scopes?: string[] | null;
  is_active?: boolean | null;
};

type LookupOptions = {
  requireActive?: boolean;
};

export async function lookupMcpApiKey(
  admin: SupabaseClient,
  token: string,
  options?: LookupOptions
): Promise<McpKeyRecord | null> {
  const keyHash = hashMcpApiKey(token);
  const select = 'tenant_id, user_id, scopes, id, is_active';

  const { data: byHashColumn } = await admin
    .from('mcp_api_keys')
    .select(select)
    .eq('api_key_hash', keyHash)
    .maybeSingle();

  if (byHashColumn && passesActiveFilter(byHashColumn, options)) {
    return byHashColumn as McpKeyRecord;
  }

  const { data: byHashedApiKey } = await admin
    .from('mcp_api_keys')
    .select(select)
    .eq('api_key', keyHash)
    .maybeSingle();

  if (byHashedApiKey && passesActiveFilter(byHashedApiKey, options)) {
    return byHashedApiKey as McpKeyRecord;
  }

  const { data: byPlain } = await admin
    .from('mcp_api_keys')
    .select(select)
    .eq('api_key', token)
    .maybeSingle();

  if (!byPlain || !passesActiveFilter(byPlain, options)) return null;

  const now = new Date().toISOString();
  const hashOnly = await admin
    .from('mcp_api_keys')
    .update({ api_key_hash: keyHash, api_key: null, updated_at: now })
    .eq('id', byPlain.id);
  if (hashOnly.error) {
    await admin
      .from('mcp_api_keys')
      .update({ api_key_hash: keyHash, api_key: keyHash, updated_at: now })
      .eq('id', byPlain.id);
  }

  return byPlain as McpKeyRecord;
}

function passesActiveFilter(
  row: { is_active?: boolean | null },
  options?: LookupOptions
): boolean {
  if (!options?.requireActive) return true;
  return row.is_active !== false;
}

export async function touchMcpApiKeyLastUsed(
  admin: SupabaseClient,
  token: string,
  _tenantId: string,
  _userId: string
): Promise<void> {
  const keyHash = hashMcpApiKey(token);
  const now = new Date().toISOString();
  const { error } = await admin
    .from('mcp_api_keys')
    .update({ last_used_at: now })
    .eq('api_key_hash', keyHash);
  if (!error) return;

  await admin
    .from('mcp_api_keys')
    .update({ last_used_at: now })
    .or(`api_key.eq.${keyHash},api_key.eq.${token}`);
}
