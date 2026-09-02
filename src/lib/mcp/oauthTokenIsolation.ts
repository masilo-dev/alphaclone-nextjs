/**
 * MCP OAuth multi-client token isolation helpers.
 *
 * Each MCP client (Claude, ChatGPT, Manus, …) must keep an independent
 * access/refresh token row scoped by (user_id, client_id). Authorizing
 * Client B must never revoke or overwrite Client A's tokens.
 */

import { oauthClientsAreEquivalent } from '@/lib/mcp/resolveCanonicalOAuthClient';

export type OAuthTokenRowLike = {
  id?: string | null;
  user_id?: string | null;
  client_id?: string | null;
  revoked?: boolean | null;
  access_token?: string | null;
  refresh_token?: string | null;
};

/** Minimal chainable shape used by revokeActiveTokensForClient (Supabase query builder). */
export type OAuthTokenUpdateClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => any;
    };
  };
};

/**
 * Revoke every *active* token for a single (user_id, client_id) pair.
 * Does not touch other clients for the same user.
 */
export async function revokeActiveTokensForClient(
  supabase: OAuthTokenUpdateClient,
  params: { userId: string; clientId: string },
): Promise<{ error: { message?: string; code?: string } | null }> {
  const { userId, clientId } = params;
  if (!userId || !clientId) {
    return {
      error: {
        message: "userId and clientId are required to revoke per-client tokens",
      },
    };
  }

  const withRevokedAt = await supabase
    .from("mcp_oauth_tokens")
    .update({
      revoked: true,
      revoked_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("revoked", false);

  const err =
    (withRevokedAt as { error?: { message?: string; code?: string } | null })
      ?.error ?? null;
  if (
    err &&
    (err.code === "42703" ||
      err.code === "PGRST204" ||
      /revoked_at|column|does not exist/i.test(err.message || ""))
  ) {
    // Older schemas may lack revoked_at — still clear the unique active index.
    const fallback = await supabase
      .from("mcp_oauth_tokens")
      .update({ revoked: true })
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .eq("revoked", false);
    return {
      error:
        (fallback as { error?: { message?: string; code?: string } | null })
          ?.error ?? null,
    };
  }

  return { error: err };
}

/**
 * Refresh grants must be bound to the same OAuth client that holds the refresh token.
 * Missing request client_id is allowed for legacy public clients; a mismatch is not.
 */
export function assertRefreshClientBinding(params: {
  requestClientId: string | null | undefined;
  tokenClientId: string | null | undefined;
  requestRedirectUris?: string[] | null;
  tokenRedirectUris?: string[] | null;
}): { ok: true } | { ok: false; reason: string } {
  const request = (params.requestClientId || "").trim();
  const token = (params.tokenClientId || "").trim();

  if (!request || !token) {
    return { ok: true };
  }

  if (request === token) {
    return { ok: true };
  }

  if (
    oauthClientsAreEquivalent(
      request,
      token,
      params.requestRedirectUris,
      params.tokenRedirectUris
    )
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `client_id mismatch on refresh: request=${request} token=${token}`,
  };
}

/**
 * Whether two token rows belong to different MCP clients for the same user.
 * Used by tests / diagnostics to prove multi-client isolation.
 */
export function tokensAreIsolatedAcrossClients(
  tokenA: OAuthTokenRowLike,
  tokenB: OAuthTokenRowLike,
): boolean {
  if (!tokenA.user_id || !tokenB.user_id) return false;
  if (tokenA.user_id !== tokenB.user_id) return false;
  if (!tokenA.client_id || !tokenB.client_id) return false;
  if (tokenA.client_id === tokenB.client_id) return false;
  if (tokenA.revoked === true || tokenB.revoked === true) return false;
  if (
    tokenA.access_token &&
    tokenB.access_token &&
    tokenA.access_token === tokenB.access_token
  ) {
    return false;
  }
  if (
    tokenA.refresh_token &&
    tokenB.refresh_token &&
    tokenA.refresh_token === tokenB.refresh_token
  ) {
    return false;
  }
  return true;
}

export function logOAuthTokenIssuance(params: {
  grantType: "authorization_code" | "refresh_token";
  clientId: string | null | undefined;
  userId: string | null | undefined;
  tenantId: string | null | undefined;
  tokenId?: string | null;
}): void {
  console.log("[MCP Token] Issued tokens", {
    grant_type: params.grantType,
    client_id: params.clientId || null,
    user_id: params.userId || null,
    tenant_id: params.tenantId || null,
    token_id: params.tokenId || null,
  });
}

export function logOAuthTokenLookup(params: {
  clientId: string | null | undefined;
  userId: string | null | undefined;
  tenantId: string | null | undefined;
  tokenId?: string | null;
  outcome:
    | "hit"
    | "miss"
    | "expired"
    | "revoked"
    | "resource_mismatch"
    | "insufficient_scope";
  requestId?: string;
}): void {
  console.log("[MCP Auth] Token lookup", {
    outcome: params.outcome,
    client_id: params.clientId || null,
    user_id: params.userId || null,
    tenant_id: params.tenantId || null,
    token_id: params.tokenId || null,
    request_id: params.requestId || null,
  });
}
