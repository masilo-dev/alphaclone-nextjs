import {
  OPENAI_APPS_OAUTH_REDIRECT_URIS,
  PLATFORM_MCP_OAUTH_CLIENT_IDS,
} from '@/lib/mcp/oauthRedirect';

export type McpOAuthClientRow = {
  client_id: string;
  is_public: boolean;
  client_secret: string | null;
  is_active?: boolean | null;
};

export type ToolCatalogMode = 'full' | 'curated';

const PLATFORM_CLIENT_SEEDS: Record<
  string,
  {
    client_name: string;
    redirect_uris: string[];
    scopes: string[];
    /** full = entire platform (default). curated = optional Apps-sized subset only. */
    toolCatalog?: ToolCatalogMode;
  }
> = {
  'chatgpt-connector': {
    client_name: 'OpenAI Apps MCP Connector',
    redirect_uris: [...OPENAI_APPS_OAUTH_REDIRECT_URIS],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    // Full platform — size handled by schema compaction in tools/list, not by cutting tools.
    toolCatalog: 'full',
  },
  // Generic public client — NOT an alias of chatgpt-connector
  'alphaclone-mcp-client': {
    client_name: 'Alphaclone MCP Client',
    redirect_uris: [],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    toolCatalog: 'full',
  },
  'manus-ai': {
    client_name: 'Manus AI',
    redirect_uris: [
      'https://manus.im/api/mcp/auth_callback',
      'https://manus.ai/api/mcp/auth_callback',
    ],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    toolCatalog: 'full',
  },
  '1778309945386-41bab8272f61': {
    client_name: 'Claude (Anthropic)',
    redirect_uris: [
      'https://claude.ai/api/mcp/auth_callback',
      'https://claude.ai/settings/oauth-callback',
      'https://api.claude.ai/v1/oauth/callback',
    ],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    toolCatalog: 'full',
  },
  'grok-connector': {
    client_name: 'Grok',
    redirect_uris: [],
    scopes: ['read', 'write', 'mcp:tools', 'mcp:resources'],
    toolCatalog: 'full',
  },
};

/**
 * Registered-client catalog policy (no User-Agent sniffing).
 * Default is the FULL platform catalog. Payload size is solved by compacting
 * schemas in tools/list — never by hiding AlphaClone tools from Claude/ChatGPT.
 */
export function getToolCatalogModeForClient(clientId: string | null | undefined): ToolCatalogMode {
  if (!clientId) return 'full';
  return PLATFORM_CLIENT_SEEDS[clientId]?.toolCatalog || 'full';
}

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
    metadata: { tool_catalog: seed.toolCatalog || 'full' },
  };

  let { error } = await supabase.from('mcp_oauth_clients').upsert(fullRow, { onConflict: 'client_id' });

  if (isMissingColumnError(error)) {
    const { grant_types: _g, response_types: _r, token_endpoint_auth_method: _t, is_active: _a, metadata: _m, ...minimal } =
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
 * Auto-seeds known bootstrap clients when absent. Unknown clients must use DCR.
 */
export async function loadMcpOAuthClient(
  supabase: any,
  clientId: string
): Promise<{ client: McpOAuthClientRow | null; error?: string }> {
  let result = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, is_public, client_secret, is_active')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle();

  if (isMissingColumnError(result.error)) {
    result = await supabase
      .from('mcp_oauth_clients')
      .select('client_id, is_public, client_secret')
      .eq('client_id', clientId)
      .maybeSingle();
  }

  if (!result.error && result.data) {
    return { client: result.data as McpOAuthClientRow };
  }

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
