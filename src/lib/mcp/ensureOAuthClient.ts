import { CHATGPT_OAUTH_REDIRECT_URIS, PLATFORM_MCP_OAUTH_CLIENT_IDS } from '@/lib/mcp/oauthRedirect';

export type McpOAuthClientRow = {
  client_id: string;
  is_public: boolean;
  client_secret: string | null;
  is_active?: boolean | null;
};

const PLATFORM_CLIENT_SEEDS: Record<
  string,
  { client_name: string; redirect_uris: string[]; scopes: string[] }
> = {
  'chatgpt-connector': {
    client_name: 'ChatGPT',
    redirect_uris: [...CHATGPT_OAUTH_REDIRECT_URIS],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
  },
  'alphaclone-mcp-client': {
    client_name: 'ChatGPT (legacy id)',
    redirect_uris: [...CHATGPT_OAUTH_REDIRECT_URIS],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
  },
  'manus-ai': {
    client_name: 'Manus AI',
    redirect_uris: [
      'https://manus.im/api/mcp/auth_callback',
      'https://manus.ai/api/mcp/auth_callback',
    ],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
  },
  '1778309945386-41bab8272f61': {
    client_name: 'Claude (Anthropic)',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
  },
};

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    Boolean(error.message?.toLowerCase().includes('column')) ||
    Boolean(error.message?.toLowerCase().includes('does not exist'))
  );
}

/** Upsert a known platform MCP OAuth client (idempotent). */
export async function ensurePlatformMcpOAuthClient(
  supabase: any,
  clientId: string
): Promise<boolean> {
  const seed = PLATFORM_CLIENT_SEEDS[clientId];
  if (!seed) return false;

  const fullRow = {
    client_id: clientId,
    client_name: seed.client_name,
    redirect_uris: seed.redirect_uris,
    is_public: true,
    client_secret: 'public',
    scopes: seed.scopes,
    is_active: true,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };

  let { error } = await supabase.from('mcp_oauth_clients').upsert(fullRow, { onConflict: 'client_id' });

  if (isMissingColumnError(error)) {
    const { grant_types: _g, response_types: _r, token_endpoint_auth_method: _t, is_active: _a, ...minimal } =
      fullRow;
    ({ error } = await supabase.from('mcp_oauth_clients').upsert(minimal, { onConflict: 'client_id' }));
  }

  if (error) {
    console.warn('[MCP OAuth] Failed to ensure platform client:', clientId, error.message);
    return false;
  }
  return true;
}

/**
 * Load an OAuth client without failing when optional columns (is_active) are missing.
 * Auto-seeds known ChatGPT/Claude/Manus clients when absent.
 */
export async function loadMcpOAuthClient(
  supabase: any,
  clientId: string
): Promise<{ client: McpOAuthClientRow | null; error?: string }> {
  // Prefer active filter when column exists
  let result = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, is_public, client_secret, is_active')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle();

  if (isMissingColumnError(result.error)) {
    // Schema without is_active (or select list mismatch)
    result = await supabase
      .from('mcp_oauth_clients')
      .select('client_id, is_public, client_secret')
      .eq('client_id', clientId)
      .maybeSingle();
  }

  if (!result.error && result.data) {
    return { client: result.data as McpOAuthClientRow };
  }

  // Not found — seed platform clients and retry once
  if (PLATFORM_MCP_OAUTH_CLIENT_IDS.has(clientId) || PLATFORM_CLIENT_SEEDS[clientId]) {
    const seeded = await ensurePlatformMcpOAuthClient(supabase, clientId);
    if (seeded) {
      const retry = await supabase
        .from('mcp_oauth_clients')
        .select('client_id, is_public, client_secret')
        .eq('client_id', clientId)
        .maybeSingle();
      if (retry.data) return { client: retry.data as McpOAuthClientRow };
    }
  }

  if (result.error) {
    console.warn('[MCP OAuth] Client lookup error:', clientId, result.error.message);
  }
  return { client: null, error: 'invalid_client' };
}
