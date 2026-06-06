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
  return process.env.VITE_AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID || '';
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

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateMicrosoftPkcePair() {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random.buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

  return {
    verifier,
    challenge: base64UrlEncode(digest),
  };
}

export function buildMicrosoftAuthorizeUrl(
  state: string,
  options?: { origin?: string; loginHint?: string; codeChallenge?: string }
) {
  const url = new URL(MICROSOFT_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', getMicrosoftClientId());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', getMicrosoftRedirectUri(options?.origin));
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', getMicrosoftScopes().join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  if (options?.codeChallenge) {
    url.searchParams.set('code_challenge', options.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  if (options?.loginHint) {
    url.searchParams.set('login_hint', options.loginHint);
  }
  return url.toString();
}
