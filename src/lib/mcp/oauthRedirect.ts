/**
 * Match OAuth redirect_uri against registered URIs.
 *
 * Supports exact matches and a trailing `/*` path-prefix pattern, with strict
 * parsing: exact scheme + hostname, allowed path prefix, no userinfo,
 * no open redirects via encoded paths or suffix domains.
 */
export function isRedirectUriAllowed(redirectUri: string, allowed: string[]): boolean {
  if (!redirectUri || !allowed?.length) return false;

  let target: URL;
  try {
    target = new URL(redirectUri);
  } catch {
    return false;
  }

  // Reject credentials in URL (https://chatgpt.com@evil.com/...)
  if (target.username || target.password) return false;

  // Reject path tricks that escape intended prefixes
  if (target.pathname.includes('..') || target.pathname.includes('%2e') || target.pathname.includes('%2E')) {
    return false;
  }

  for (const pattern of allowed) {
    if (!pattern) continue;

    try {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1); // keep trailing /
        const base = new URL(prefix);

        if (base.username || base.password) continue;
        if (target.protocol !== base.protocol) continue;
        if (target.hostname.toLowerCase() !== base.hostname.toLowerCase()) continue;
        // Exact host only — never suffix-domain match (chatgpt.com.evil.com)
        if (target.port !== base.port) continue;

        const allowedPath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
        const targetPath = target.pathname.endsWith('/') ? target.pathname : `${target.pathname}/`;
        // Path must start with the allowed prefix (after normalizing trailing slash for compare)
        if (
          target.pathname === base.pathname.replace(/\/$/, '') ||
          target.pathname.startsWith(allowedPath) ||
          targetPath.startsWith(allowedPath)
        ) {
          return true;
        }
      } else if (pattern === redirectUri) {
        return true;
      } else {
        // Exact URL compare ignoring trailing slash on path
        const exact = new URL(pattern);
        if (exact.username || exact.password) continue;
        if (
          target.protocol === exact.protocol &&
          target.hostname.toLowerCase() === exact.hostname.toLowerCase() &&
          target.port === exact.port &&
          target.pathname.replace(/\/$/, '') === exact.pathname.replace(/\/$/, '')
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

export const CHATGPT_OAUTH_REDIRECT_URIS = [
  'https://chatgpt.com/connector_platform_oauth_redirect',
  'https://chatgpt.com/connector/oauth/*',
  'https://chatgpt.com/connector/oauth/callback',
  'https://chat.openai.com/connector_platform_oauth_redirect',
  'https://chat.openai.com/connector/oauth/*',
  'https://chat.openai.com/connector/oauth/callback',
  'https://platform.openai.com/apps-manage/oauth/*',
];

const MCP_CLIENT_ID_ALIASES: Record<string, string> = {
  'alphaclone-mcp-client': 'chatgpt-connector',
};

/** Pre-registered OAuth clients for AI connectors (ChatGPT, Claude, Grok, Manus). */
export const PLATFORM_MCP_OAUTH_CLIENT_IDS = new Set([
  'chatgpt-connector',
  'alphaclone-mcp-client',
  'grok-connector',
  'manus-ai',
  '1778309945386-41bab8272f61',
]);

/** Map known connector aliases to the canonical client id we store in the database. */
export function normalizeMcpClientId(clientId: string | null | undefined): string | null {
  if (!clientId) return null;
  return MCP_CLIENT_ID_ALIASES[clientId] || clientId;
}

/** Treat /api/mcp/sse as an alias for the canonical /api/mcp resource. */
export function normalizeMcpResourceUrl(resourceUrl: string | null | undefined): string | null {
  if (!resourceUrl) return null;

  try {
    const parsed = new URL(resourceUrl);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      parsed.port = '';
    }
    let pathname = parsed.pathname.replace(/\/$/, '') || '';
    if (pathname === '/api/mcp/sse') pathname = '/api/mcp';
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return resourceUrl.replace(/\/$/, '').replace(/\/api\/mcp\/sse$/, '/api/mcp');
  }
}

export function isMcpResourceEquivalent(
  resourceUrl: string | null | undefined,
  expectedResource: string
): boolean {
  const normalizedResource = normalizeMcpResourceUrl(resourceUrl);
  const normalizedExpected = normalizeMcpResourceUrl(expectedResource);
  return !!normalizedResource && !!normalizedExpected && normalizedResource === normalizedExpected;
}

/**
 * Browser OAuth connectors (ChatGPT, Claude.ai, etc.) send PKCE and expect a login +
 * consent page — not the legacy MCP API-key form.
 */
export function shouldUseBrowserOAuthConsent(params: {
  clientId: string;
  codeChallenge: string | null;
  isPublicClient?: boolean;
}): boolean {
  if (params.codeChallenge) return true;
  if (
    PLATFORM_MCP_OAUTH_CLIENT_IDS.has(params.clientId) ||
    PLATFORM_MCP_OAUTH_CLIENT_IDS.has(normalizeMcpClientId(params.clientId) || '')
  ) {
    return true;
  }
  return params.isPublicClient === true;
}

export function buildAuthorizePageUrl(origin: string, searchParams: URLSearchParams): string {
  const url = new URL('/authorize', origin);
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}
