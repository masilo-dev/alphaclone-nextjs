/**
 * Match OAuth redirect_uri against registered URIs.
 *
 * Supports exact matches and a trailing `/*` path-prefix pattern, with strict
 * parsing: exact scheme + hostname, allowed path prefix, no userinfo,
 * no open redirects via encoded paths or suffix domains.
 *
 * Universal MCP: redirect allowlists come from registered client metadata only.
 * Do not inject provider-specific URIs at authorize time.
 */
export function isRedirectUriAllowed(
  redirectUri: string,
  allowed: string[],
): boolean {
  if (!redirectUri || !allowed?.length) return false;

  let target: URL;
  try {
    target = new URL(redirectUri);
  } catch {
    return false;
  }

  if (target.username || target.password) return false;

  if (
    target.pathname.includes("..") ||
    target.pathname.includes("%2e") ||
    target.pathname.includes("%2E")
  ) {
    return false;
  }

  for (const pattern of allowed) {
    if (!pattern) continue;

    try {
      if (pattern.endsWith("/*")) {
        const prefix = pattern.slice(0, -1);
        const base = new URL(prefix);

        if (base.username || base.password) continue;
        if (target.protocol !== base.protocol) continue;
        if (target.hostname.toLowerCase() !== base.hostname.toLowerCase())
          continue;
        if (target.port !== base.port) continue;

        const allowedPath = base.pathname.endsWith("/")
          ? base.pathname
          : `${base.pathname}/`;
        const targetPath = target.pathname.endsWith("/")
          ? target.pathname
          : `${target.pathname}/`;
        if (
          target.pathname === base.pathname.replace(/\/$/, "") ||
          target.pathname.startsWith(allowedPath) ||
          targetPath.startsWith(allowedPath)
        ) {
          return true;
        }
      } else if (pattern === redirectUri) {
        return true;
      } else {
        const exact = new URL(pattern);
        if (exact.username || exact.password) continue;
        if (
          target.protocol === exact.protocol &&
          target.hostname.toLowerCase() === exact.hostname.toLowerCase() &&
          target.port === exact.port &&
          target.pathname.replace(/\/$/, "") ===
            exact.pathname.replace(/\/$/, "")
        ) {
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  return false;
}

/** Canonical Claude.ai / Claude Desktop / Claude Code redirect URIs (union of migrations + Anthropic callbacks). */
export const CLAUDE_OAUTH_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.ai/api/oauth/callback",
  "https://claude.ai/settings/oauth-callback",
  "https://claude.ai/auth/callback",
  "https://api.claude.ai/v1/oauth/callback",
  "https://www.claude.ai/api/mcp/auth_callback",
  "https://www.claude.ai/api/oauth/callback",
] as const;

/** Seed redirect URIs for the OpenAI Apps connector client only (stored on that client row). */
export const OPENAI_APPS_OAUTH_REDIRECT_URIS = [
  "https://chatgpt.com/connector_platform_oauth_redirect",
  "https://chatgpt.com/connector/oauth/*",
  "https://chatgpt.com/connector/oauth/callback",
  "https://chat.openai.com/connector_platform_oauth_redirect",
  "https://chat.openai.com/connector/oauth/*",
  "https://chat.openai.com/connector/oauth/callback",
  "https://platform.openai.com/apps-manage/oauth/*",
];

/** @deprecated Use OPENAI_APPS_OAUTH_REDIRECT_URIS — kept for import compatibility */
export const CHATGPT_OAUTH_REDIRECT_URIS = OPENAI_APPS_OAUTH_REDIRECT_URIS;

/**
 * Optional bootstrap client ids that may be auto-seeded if missing.
 * These are convenience seeds, not runtime capability gates.
 * Any other client must use Dynamic Client Registration.
 */
export const PLATFORM_MCP_OAUTH_CLIENT_IDS = new Set([
  "chatgpt-connector",
  "cursor-connector",
  "alphaclone-mcp-client",
  "grok-connector",
  "manus-ai",
  "1778309945386-41bab8272f61",
  "CLAUDE",
  "claude-web",
]);

/**
 * Identity-preserving client id normalization for wire protocol.
 * Use resolveCanonicalOAuthClientId* when storing tokens/grants so the same
 * tenant always maps to one platform client (e.g. all ChatGPT → chatgpt-connector).
 */
export function normalizeMcpClientId(
  clientId: string | null | undefined,
): string | null {
  if (!clientId) return null;
  return clientId.trim();
}

/** Treat /api/mcp/sse as an alias for the canonical /api/mcp resource. */
export function normalizeMcpResourceUrl(
  resourceUrl: string | null | undefined,
): string | null {
  if (!resourceUrl) return null;

  try {
    const parsed = new URL(resourceUrl);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === "https:" && parsed.port === "443") ||
      (parsed.protocol === "http:" && parsed.port === "80")
    ) {
      parsed.port = "";
    }
    let pathname = parsed.pathname.replace(/\/$/, "") || "";
    if (pathname === "/api/mcp/sse") pathname = "/api/mcp";
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return resourceUrl
      .replace(/\/$/, "")
      .replace(/\/api\/mcp\/sse$/, "/api/mcp");
  }
}

export function isMcpResourceEquivalent(
  resourceUrl: string | null | undefined,
  expectedResource: string,
): boolean {
  const normalizedResource = normalizeMcpResourceUrl(resourceUrl);
  const normalizedExpected = normalizeMcpResourceUrl(expectedResource);
  return (
    !!normalizedResource &&
    !!normalizedExpected &&
    normalizedResource === normalizedExpected
  );
}

/**
 * Browser OAuth clients send PKCE and expect login + consent — not API-key form.
 * Decision is based on PKCE / public client flags, never provider name.
 */
export function shouldUseBrowserOAuthConsent(params: {
  clientId: string;
  codeChallenge: string | null;
  isPublicClient?: boolean;
}): boolean {
  if (params.codeChallenge) return true;
  if (params.isPublicClient === true) return true;
  if (PLATFORM_MCP_OAUTH_CLIENT_IDS.has(params.clientId)) return true;
  return false;
}

export function buildAuthorizePageUrl(
  origin: string,
  searchParams: URLSearchParams,
): string {
  const url = new URL("/authorize", origin);
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}
