import {
  isRedirectUriAllowed,
  OPENAI_APPS_OAUTH_REDIRECT_URIS,
  CLAUDE_OAUTH_REDIRECT_URIS,
  PLATFORM_MCP_OAUTH_CLIENT_IDS,
} from '@/lib/mcp/oauthRedirect';

/** Canonical OAuth client id for all ChatGPT / OpenAI Apps connectors. */
export const CHATGPT_CANONICAL_CLIENT_ID = 'chatgpt-connector';

/** Canonical OAuth client id for Claude (Anthropic). */
export const CLAUDE_CANONICAL_CLIENT_ID = '1778309945386-41bab8272f61';

const CLAUDE_ALIASES = new Set(['CLAUDE', 'claude-web', CLAUDE_CANONICAL_CLIENT_ID]);

export type OAuthClientFamily = 'chatgpt' | 'claude' | 'cursor' | 'generic';

export function redirectUrisIndicateChatGpt(redirectUris: string[] | null | undefined): boolean {
  if (!redirectUris?.length) return false;
  return redirectUris.some((uri) => isRedirectUriAllowed(uri, [...OPENAI_APPS_OAUTH_REDIRECT_URIS]));
}

export function redirectUrisIndicateClaude(redirectUris: string[] | null | undefined): boolean {
  if (!redirectUris?.length) return false;
  return redirectUris.some((uri) => isRedirectUriAllowed(uri, [...CLAUDE_OAUTH_REDIRECT_URIS]));
}

export function getOAuthClientFamily(
  clientId: string | null | undefined,
  redirectUris?: string[] | null
): OAuthClientFamily {
  const canonical = resolveCanonicalOAuthClientIdSync(clientId, redirectUris);
  if (canonical === CHATGPT_CANONICAL_CLIENT_ID) return 'chatgpt';
  if (canonical === CLAUDE_CANONICAL_CLIENT_ID || CLAUDE_ALIASES.has(canonical || '')) return 'claude';
  if (canonical === 'cursor-connector') return 'cursor';
  return 'generic';
}

/**
 * Map dynamic or alias client ids to the single canonical id per platform.
 * Same AlphaClone tenant/user connecting from different ChatGPT accounts
 * must always resolve to chatgpt-connector for tokens, grants, and UI.
 */
export function resolveCanonicalOAuthClientIdSync(
  clientId: string | null | undefined,
  redirectUris?: string[] | null
): string | null {
  if (!clientId) return null;
  const trimmed = clientId.trim();
  if (!trimmed) return null;

  if (trimmed === CHATGPT_CANONICAL_CLIENT_ID) return CHATGPT_CANONICAL_CLIENT_ID;
  if (redirectUrisIndicateChatGpt(redirectUris)) return CHATGPT_CANONICAL_CLIENT_ID;

  if (CLAUDE_ALIASES.has(trimmed)) return CLAUDE_CANONICAL_CLIENT_ID;
  if (redirectUrisIndicateClaude(redirectUris)) return CLAUDE_CANONICAL_CLIENT_ID;

  return trimmed;
}

/** Async resolver — looks up DCR `ac_*` clients by stored redirect URIs. */
export async function resolveCanonicalOAuthClientId(
  supabase: { from: (table: string) => any },
  clientId: string | null | undefined,
  redirectUris?: string[] | null
): Promise<string | null> {
  const sync = resolveCanonicalOAuthClientIdSync(clientId, redirectUris);
  if (!sync || sync === CHATGPT_CANONICAL_CLIENT_ID || sync === CLAUDE_CANONICAL_CLIENT_ID) {
    return sync;
  }

  if (!clientId?.startsWith('ac_')) return sync;

  try {
    const { data } = await supabase
      .from('mcp_oauth_clients')
      .select('client_id, redirect_uris, metadata')
      .eq('client_id', clientId.trim())
      .maybeSingle();

    if (data) {
      const uris = Array.isArray(data.redirect_uris) ? (data.redirect_uris as string[]) : [];
      const fromUris = resolveCanonicalOAuthClientIdSync(clientId, uris);
      if (fromUris === CHATGPT_CANONICAL_CLIENT_ID || fromUris === CLAUDE_CANONICAL_CLIENT_ID) {
        return fromUris;
      }
      const family = (data.metadata as { canonical_family?: string } | null)?.canonical_family;
      if (family === 'chatgpt') return CHATGPT_CANONICAL_CLIENT_ID;
      if (family === 'claude') return CLAUDE_CANONICAL_CLIENT_ID;
    }
  } catch {
    // fall through to sync result
  }

  return sync;
}

/** True when two client ids belong to the same platform family (e.g. ac_* ChatGPT DCR ≈ chatgpt-connector). */
export function oauthClientsAreEquivalent(
  clientA: string | null | undefined,
  clientB: string | null | undefined,
  redirectUrisA?: string[] | null,
  redirectUrisB?: string[] | null
): boolean {
  const a = resolveCanonicalOAuthClientIdSync(clientA, redirectUrisA);
  const b = resolveCanonicalOAuthClientIdSync(clientB, redirectUrisB);
  if (!a || !b) return a === b;
  return a === b;
}

export function getOAuthClientDisplayName(
  clientId: string | null | undefined,
  redirectUris?: string[] | null
): string {
  const family = getOAuthClientFamily(clientId, redirectUris);
  switch (family) {
    case 'chatgpt':
      return 'ChatGPT';
    case 'claude':
      return 'Claude';
    case 'cursor':
      return 'Cursor';
    default:
      return clientId || 'MCP Client';
  }
}

/** All client_id values that represent ChatGPT for a tenant integration query. */
export const CHATGPT_CLIENT_ID_FILTER = [CHATGPT_CANONICAL_CLIENT_ID] as const;

export function isKnownPlatformClient(clientId: string | null | undefined): boolean {
  if (!clientId) return false;
  return PLATFORM_MCP_OAUTH_CLIENT_IDS.has(clientId.trim());
}

/** Whether an active OAuth token row belongs to the ChatGPT platform family. */
export async function isChatGptOAuthClientId(
  supabase: { from: (table: string) => any },
  clientId: string | null | undefined,
  redirectUris?: string[] | null
): Promise<boolean> {
  const canonical = await resolveCanonicalOAuthClientId(supabase, clientId, redirectUris);
  return canonical === CHATGPT_CANONICAL_CLIENT_ID;
}

/** True when the user has any non-revoked ChatGPT OAuth token for this tenant. */
export async function userHasActiveChatGptOAuthConnection(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; userId: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('mcp_oauth_tokens')
    .select('client_id')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .eq('revoked', false);

  if (error || !data?.length) return false;

  for (const row of data) {
    if (await isChatGptOAuthClientId(supabase, row.client_id, null)) {
      return true;
    }
  }
  return false;
}

/** Revoke/delete all ChatGPT-family OAuth tokens for a user within a tenant. */
export async function deleteChatGptOAuthTokensForUser(
  supabase: { from: (table: string) => any },
  params: { tenantId: string; userId: string }
): Promise<void> {
  const { data } = await supabase
    .from('mcp_oauth_tokens')
    .select('id, client_id')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId);

  if (!data?.length) return;

  const ids: string[] = [];
  for (const row of data) {
    if (await isChatGptOAuthClientId(supabase, row.client_id, null)) {
      if (row.id) ids.push(String(row.id));
    }
  }

  if (!ids.length) return;

  await supabase.from('mcp_oauth_tokens').delete().in('id', ids);
}
