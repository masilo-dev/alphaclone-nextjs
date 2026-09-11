/** Match OAuth redirect_uri against registered URIs, including trailing /* wildcards. */
export function isRedirectUriAllowed(redirectUri: string, allowed: string[]): boolean {
  if (!redirectUri || !allowed?.length) return false;

  try {
    const target = new URL(redirectUri);
    for (const pattern of allowed) {
      if (!pattern) continue;
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1);
        const base = new URL(prefix);
        if (target.origin === base.origin && target.pathname.startsWith(base.pathname)) {
          return true;
        }
      } else if (pattern === redirectUri) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export const CHATGPT_OAUTH_REDIRECT_URIS = [
  'https://chatgpt.com/connector_platform_oauth_redirect',
  'https://chatgpt.com/connector/oauth/*',
  'https://chat.openai.com/connector_platform_oauth_redirect',
  'https://chat.openai.com/connector/oauth/*',
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
    const pathname = parsed.pathname.replace(/\/$/, '');
    if (pathname === '/api/mcp/sse') {
      parsed.pathname = '/api/mcp';
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    // If it's not a valid URL, fall through to the raw-string alias handling.
  }

  return resourceUrl.replace(/\/$/, '').replace(/\/api\/mcp\/sse$/, '/api/mcp');
}

export function isMcpResourceEquivalent(resourceUrl: string | null | undefined, expectedResource: string): boolean {
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
  if (PLATFORM_MCP_OAUTH_CLIENT_IDS.has(params.clientId) || PLATFORM_MCP_OAUTH_CLIENT_IDS.has(normalizeMcpClientId(params.clientId) || '')) {
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
