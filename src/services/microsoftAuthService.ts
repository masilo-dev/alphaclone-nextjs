import { ENV } from '@/config/env';
import {
  buildMicrosoftAuthorizeUrl,
  generateMicrosoftPkcePair,
  getMicrosoftRedirectUri,
} from '@/config/microsoft';
import { supabase } from '@/lib/supabase';

const MICROSOFT_OAUTH_STATE_KEY = 'alphaclone.microsoft.oauth.state';
const MICROSOFT_OAUTH_REDIRECT_KEY = 'alphaclone.microsoft.oauth.redirect';
const MICROSOFT_OAUTH_RETURN_KEY = 'alphaclone.microsoft.oauth.return';
const MICROSOFT_OAUTH_VERIFIER_KEY = 'alphaclone.microsoft.oauth.verifier';

export interface MicrosoftConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  microsoft_email: string | null;
  display_name: string | null;
  created_at?: string;
  updated_at?: string;
}

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error('You must be signed in to connect Microsoft 365.');
  }

  return user.id;
}

async function invokeSupabaseFunction<T>(name: string, body: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Missing authenticated session.');
  }

  const response = await fetch(`${ENV.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ENV.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Failed calling ${name}`);
  }

  return payload as T;
}

export const microsoftAuthService = {
  async getConnection(): Promise<MicrosoftConnection | null> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('microsoft_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as MicrosoftConnection | null;
  },

  async isConnected(): Promise<boolean> {
    const connection = await this.getConnection();
    return !!connection?.access_token;
  },

  async initiateOAuth(returnTo?: string) {
    const state =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;

    if (typeof window !== 'undefined') {
      const redirectUri = getMicrosoftRedirectUri(window.location.origin);
      const { verifier, challenge } = await generateMicrosoftPkcePair();
      sessionStorage.setItem(MICROSOFT_OAUTH_STATE_KEY, state);
      sessionStorage.setItem(MICROSOFT_OAUTH_REDIRECT_KEY, redirectUri);
      sessionStorage.setItem(MICROSOFT_OAUTH_VERIFIER_KEY, verifier);
      if (returnTo) {
        sessionStorage.setItem(MICROSOFT_OAUTH_RETURN_KEY, returnTo);
      } else {
        sessionStorage.removeItem(MICROSOFT_OAUTH_RETURN_KEY);
      }
      window.location.href = buildMicrosoftAuthorizeUrl(state, {
        origin: window.location.origin,
        codeChallenge: challenge,
      });
    }

    return state;
  },

  getOAuthReturnPath() {
    if (typeof window === 'undefined') {
      return '/dashboard/settings';
    }

    return sessionStorage.getItem(MICROSOFT_OAUTH_RETURN_KEY) || '/dashboard/settings';
  },

  async handleCallback(code: string, state?: string) {
    if (!code) {
      throw new Error('Missing Microsoft authorization code.');
    }

    let redirectUri = getMicrosoftRedirectUri();
    let codeVerifier: string | null = null;

    if (typeof window !== 'undefined') {
      const expectedState = sessionStorage.getItem(MICROSOFT_OAUTH_STATE_KEY);
      if (expectedState && state && expectedState !== state) {
        throw new Error('Microsoft OAuth state validation failed.');
      }
      redirectUri = sessionStorage.getItem(MICROSOFT_OAUTH_REDIRECT_KEY) || redirectUri;
      codeVerifier = sessionStorage.getItem(MICROSOFT_OAUTH_VERIFIER_KEY);
      sessionStorage.removeItem(MICROSOFT_OAUTH_STATE_KEY);
      sessionStorage.removeItem(MICROSOFT_OAUTH_REDIRECT_KEY);
      sessionStorage.removeItem(MICROSOFT_OAUTH_VERIFIER_KEY);
    }

    if (!codeVerifier) {
      throw new Error('Missing Microsoft PKCE verifier. Please start the connection again.');
    }

    return invokeSupabaseFunction<{
      success: boolean;
      connection: MicrosoftConnection;
    }>('microsoft-oauth-exchange', {
      code,
      redirectUri,
      codeVerifier,
    });
  },

  async refreshAccessToken(refreshToken?: string) {
    const connection = await this.getConnection();
    const token = refreshToken || connection?.refresh_token;
    if (!token) {
      throw new Error('No Microsoft refresh token available.');
    }

    return invokeSupabaseFunction<{
      success: boolean;
      connection: MicrosoftConnection;
    }>('microsoft-token-refresh', { refreshToken: token });
  },

  async getValidAccessToken() {
    const connection = await this.getConnection();
    if (!connection?.access_token) {
      throw new Error('Microsoft 365 is not connected.');
    }

    const expiresAt = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0;
    const refreshWindowMs = 5 * 60 * 1000;

    if (expiresAt && Date.now() + refreshWindowMs >= expiresAt) {
      const refreshed = await this.refreshAccessToken(connection.refresh_token);
      return refreshed.connection.access_token;
    }

    return connection.access_token;
  },

  async disconnect() {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('microsoft_connections').delete().eq('user_id', userId);
    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  },
};
