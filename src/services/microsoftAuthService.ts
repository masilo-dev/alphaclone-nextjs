import { ENV } from '@/config/env';
import {
  buildMicrosoftAuthorizeUrl,
  getMicrosoftRedirectUri,
} from '@/config/microsoft';
import { supabase } from '@/lib/supabase';

const MICROSOFT_OAUTH_STATE_KEY = 'alphaclone.microsoft.oauth.state';

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

  initiateOAuth() {
    const state =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MICROSOFT_OAUTH_STATE_KEY, state);
      window.location.href = buildMicrosoftAuthorizeUrl(state);
    }

    return state;
  },

  async handleCallback(code: string, state?: string) {
    if (!code) {
      throw new Error('Missing Microsoft authorization code.');
    }

    if (typeof window !== 'undefined') {
      const expectedState = sessionStorage.getItem(MICROSOFT_OAUTH_STATE_KEY);
      if (expectedState && state && expectedState !== state) {
        throw new Error('Microsoft OAuth state validation failed.');
      }
      sessionStorage.removeItem(MICROSOFT_OAUTH_STATE_KEY);
    }

    return invokeSupabaseFunction<{
      success: boolean;
      connection: MicrosoftConnection;
    }>('microsoft-oauth-exchange', {
      code,
      redirectUri: getMicrosoftRedirectUri(),
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
