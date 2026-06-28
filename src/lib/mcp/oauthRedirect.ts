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

/** Pre-registered OAuth clients for AI connectors (ChatGPT, Claude, Grok, Manus). */
export const PLATFORM_MCP_OAUTH_CLIENT_IDS = new Set([
  'chatgpt-connector',
  'grok-connector',
  'manus-ai',
  '1778309945386-41bab8272f61',
]);

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
  if (PLATFORM_MCP_OAUTH_CLIENT_IDS.has(params.clientId)) return true;
  return params.isPublicClient === true;
}

export function buildAuthorizePageUrl(origin: string, searchParams: URLSearchParams): string {
  const url = new URL('/authorize', origin);
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}
