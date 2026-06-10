import { supabase } from '@/lib/supabase';

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

  initiateOAuth(returnTo?: string) {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams();
    if (returnTo) {
      params.set('returnTo', returnTo);
    }

    const query = params.toString();
    window.location.href = query
      ? `/api/auth/microsoft/connect?${query}`
      : '/api/auth/microsoft/connect';
  },

  async refreshAccessToken(refreshToken?: string) {
    const connection = await this.getConnection();
    const token = refreshToken || connection?.refresh_token;
    if (!token) {
      throw new Error('No Microsoft refresh token available.');
    }

    const response = await fetch('/api/auth/microsoft/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: token }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to refresh Microsoft access token.');
    }

    return payload as {
      success: boolean;
      connection: MicrosoftConnection;
    };
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
