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

function tokenNeedsRefresh(tokenExpiry: string | null | undefined, force = false): boolean {
  if (force) return true;
  if (!tokenExpiry) return true;
  const expiresAt = new Date(tokenExpiry).getTime();
  if (Number.isNaN(expiresAt)) return true;
  return Date.now() + 5 * 60 * 1000 >= expiresAt;
}

let refreshInFlight: Promise<{ success: boolean; connection: MicrosoftConnection }> | null = null;

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

  async refreshAccessToken(refreshToken?: string, options?: { force?: boolean }) {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const connection = await this.getConnection();
      const token = refreshToken || connection?.refresh_token;
      if (!token) {
        throw new Error('No Microsoft refresh token available.');
      }

      if (!options?.force && connection && !tokenNeedsRefresh(connection.token_expiry)) {
        return { success: true, connection };
      }

      const response = await fetch('/api/auth/microsoft/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: token, force: options?.force === true }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to refresh Microsoft access token.');
      }

      return payload as {
        success: boolean;
        connection: MicrosoftConnection;
        refreshed?: boolean;
      };
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  },

  async getValidAccessToken(options?: { force?: boolean }) {
    const connection = await this.getConnection();
    if (!connection?.access_token) {
      throw new Error('Microsoft 365 is not connected.');
    }

    if (tokenNeedsRefresh(connection.token_expiry, options?.force)) {
      const refreshed = await this.refreshAccessToken(connection.refresh_token, options);
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
