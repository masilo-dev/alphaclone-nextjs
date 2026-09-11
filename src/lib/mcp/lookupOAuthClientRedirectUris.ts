/**
 * Resolve OAuth client redirect URIs and refresh-token client binding.
 */

import {
  oauthClientsAreEquivalent,
  resolveCanonicalOAuthClientId,
  resolveCanonicalOAuthClientIdSync,
  CHATGPT_CANONICAL_CLIENT_ID,
} from '@/lib/mcp/resolveCanonicalOAuthClient';
import { OPENAI_APPS_OAUTH_REDIRECT_URIS } from '@/lib/mcp/oauthRedirect';

type OAuthClientRedirectLookup = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { redirect_uris?: unknown; metadata?: unknown } | null; error?: unknown }>;
      };
    };
  };
};

export async function lookupOAuthClientRedirectUris(
  supabase: OAuthClientRedirectLookup,
  clientId: string | null | undefined
): Promise<string[] | null> {
  const id = (clientId || '').trim();
  if (!id) return null;

  try {
    const { data } = await supabase
      .from('mcp_oauth_clients')
      .select('redirect_uris')
      .eq('client_id', id)
      .maybeSingle();

    if (Array.isArray(data?.redirect_uris)) {
      return data.redirect_uris.filter((u): u is string => typeof u === 'string');
    }
  } catch {
    // non-fatal — binding falls back to canonical id comparison
  }

  return null;
}

/** Avoid Supabase generic depth when passing admin client into lookup helper. */
export function asOAuthClientRedirectLookup(supabase: unknown): OAuthClientRedirectLookup {
  return supabase as OAuthClientRedirectLookup;
}

type SupabaseCanonicalResolver = Parameters<typeof resolveCanonicalOAuthClientId>[0];

function chatGptRedirectFallback(clientId: string | null | undefined): string[] | null {
  const id = (clientId || '').trim();
  if (id === CHATGPT_CANONICAL_CLIENT_ID || id.startsWith('ac_')) {
    return [...OPENAI_APPS_OAUTH_REDIRECT_URIS];
  }
  return null;
}

/**
 * Async refresh binding — resolves DCR ac_* ids to chatgpt-connector before comparing.
 */
export async function assertRefreshClientBindingAsync(params: {
  supabase: unknown;
  requestClientId: string | null | undefined;
  tokenClientId: string | null | undefined;
  requestRedirectUri?: string | null;
}): Promise<{ ok: true; requestCanonical: string | null; tokenCanonical: string | null } | { ok: false; reason: string }> {
  const lookup = asOAuthClientRedirectLookup(params.supabase);
  const resolver = params.supabase as SupabaseCanonicalResolver;

  let requestRedirectUris =
    (await lookupOAuthClientRedirectUris(lookup, params.requestClientId)) ??
    chatGptRedirectFallback(params.requestClientId);
  if (!requestRedirectUris?.length && params.requestRedirectUri) {
    requestRedirectUris = [params.requestRedirectUri];
  }

  let tokenRedirectUris =
    (await lookupOAuthClientRedirectUris(lookup, params.tokenClientId)) ??
    chatGptRedirectFallback(params.tokenClientId);

  const [requestCanonical, tokenCanonical] = await Promise.all([
    resolveCanonicalOAuthClientId(resolver, params.requestClientId, requestRedirectUris),
    resolveCanonicalOAuthClientId(resolver, params.tokenClientId, tokenRedirectUris),
  ]);

  const requestForCompare = requestCanonical ?? params.requestClientId;
  const tokenForCompare = tokenCanonical ?? params.tokenClientId;

  if (
    requestForCompare &&
    tokenForCompare &&
    requestForCompare === tokenForCompare
  ) {
    return { ok: true, requestCanonical: requestForCompare, tokenCanonical: tokenForCompare };
  }

  if (
    oauthClientsAreEquivalent(
      params.requestClientId,
      params.tokenClientId,
      requestRedirectUris,
      tokenRedirectUris
    )
  ) {
    return {
      ok: true,
      requestCanonical: resolveCanonicalOAuthClientIdSync(params.requestClientId, requestRedirectUris),
      tokenCanonical: resolveCanonicalOAuthClientIdSync(params.tokenClientId, tokenRedirectUris),
    };
  }

  return {
    ok: false,
    reason: `client_id mismatch on refresh: request=${params.requestClientId || 'null'} token=${params.tokenClientId || 'null'}`,
  };
}
