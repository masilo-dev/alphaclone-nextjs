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
