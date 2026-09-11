import { buildPublicCallbackUrl, PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';

/**
 * Registry of OAuth callback URLs that must be configured with external providers.
 * Derived from actual App Router paths — do not invent alternate paths.
 */
export const OAUTH_CALLBACKS = {
  supabaseAuth: buildPublicCallbackUrl('/auth/callback'),
  microsoft: buildPublicCallbackUrl('/auth/microsoft/callback'),
  googleGmail: buildPublicCallbackUrl('/api/auth/google/gmail/callback'),
  googleCalendar: buildPublicCallbackUrl('/api/auth/google/calendar/callback'),
  facebook: buildPublicCallbackUrl('/api/auth/facebook/callback'),
  instagram: buildPublicCallbackUrl('/api/auth/instagram/callback'),
  linkedin: buildPublicCallbackUrl('/api/auth/linkedin/callback'),
  x: buildPublicCallbackUrl('/api/auth/callback/x'),
  hubspot: buildPublicCallbackUrl('/api/auth/hubspot/callback'),
  zoho: buildPublicCallbackUrl('/api/auth/zoho/callback'),
  calendly: buildPublicCallbackUrl('/api/auth/calendly/callback'),
  slack: buildPublicCallbackUrl('/api/slack/oauth/callback'),
  zoom: buildPublicCallbackUrl('/api/zoom/oauth/callback'),
  stripeConnect: buildPublicCallbackUrl('/api/stripe/connect/callback'),
  mcpAuthorizePage: buildPublicCallbackUrl('/authorize'),
} as const;

export type OAuthCallbackKey = keyof typeof OAUTH_CALLBACKS;

/** Human-readable list for provider consoles / ops docs. */
export function listOAuthCallbackUrls(): Array<{ provider: OAuthCallbackKey; url: string }> {
  return (Object.keys(OAUTH_CALLBACKS) as OAuthCallbackKey[]).map((provider) => ({
    provider,
    url: OAUTH_CALLBACKS[provider],
  }));
}

export { PUBLIC_APP_ORIGIN, buildPublicCallbackUrl };
