import { ENV } from '@/config/env';

export const MICROSOFT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
export const MICROSOFT_OAUTH_AUTHORIZE_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

export const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Calendars.ReadWrite',
  'Tasks.ReadWrite',
  'Files.ReadWrite',
  'Contacts.Read',
  'Team.ReadBasic.All',
  'OnlineMeetings.ReadWrite',
] as const;

export const MICROSOFT_DEFAULT_REDIRECT_PATH = '/auth/microsoft/callback';

export function getMicrosoftClientId() {
  return (
    process.env.AZURE_CLIENT_ID ||
    process.env.VITE_AZURE_CLIENT_ID ||
    ENV.AZURE_CLIENT_ID ||
    ENV.VITE_AZURE_CLIENT_ID ||
    ''
  );
}

export function getMicrosoftRedirectUri(origin?: string) {
  const base = (
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : null) ||
    ENV.NEXT_PUBLIC_APP_URL ||
    'https://alphaclonesystems.com'
  ).replace(/\/$/, '');

  return `${base}${MICROSOFT_DEFAULT_REDIRECT_PATH}`;
}

export function getMicrosoftScopes() {
  return [...MICROSOFT_SCOPES];
}

export function buildMicrosoftAuthorizeUrl(
  state: string,
  options: { origin?: string; loginHint?: string }
) {
  const url = new URL(MICROSOFT_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', getMicrosoftClientId());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', getMicrosoftRedirectUri(options.origin));
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', getMicrosoftScopes().join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  // NOTE: No code_challenge/code_challenge_method — Azure app uses Web redirect URIs
  // (not SPA), so the server-side confidential-client flow with client_secret is used.
  if (options.loginHint) {
    url.searchParams.set('login_hint', options.loginHint);
  }
  return url.toString();
}
