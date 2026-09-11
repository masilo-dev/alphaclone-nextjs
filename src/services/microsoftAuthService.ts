import { supabase } from '@/lib/supabase';

export interface MicrosoftConnection {
  id?: string;
  user_id: string;
  access_token?: string | null;
  refresh_token?: string | null;
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

export function humanizeMicrosoftOAuthReason(reason: string | null | undefined): string {
  const value = (reason || '').trim();
  if (!value) return 'Microsoft connection failed';

  const normalized = value.toLowerCase();
  if (normalized.includes('access_denied')) return 'Microsoft sign-in was canceled or permissions were denied.';
  if (normalized.includes('invalid_state')) return 'Microsoft sign-in expired. Please try connecting again.';
  if (normalized.includes('missing_params')) return 'Microsoft sign-in returned incomplete data. Please try again.';
  if (normalized.includes('not_configured')) return 'Microsoft OAuth is not configured on the server.';
  if (normalized.includes('failed to exchange') || normalized.includes('invalid_grant')) {
    return 'Microsoft sign-in code exchange failed. Please reconnect and try again.';
  }
  if (normalized.includes('failed to load microsoft profile')) {
    return 'Microsoft connected, but profile lookup failed. Please reconnect and try again.';
  }
  if (normalized.includes('aadsts50011') || normalized.includes('redirect uri')) {
    return 'Microsoft rejected the redirect URL. Check the Azure app redirect URI configuration.';
  }

  return value;
}

let refreshInFlight: Promise<{ success: boolean; connection: MicrosoftConnection }> | null = null;

export const microsoftAuthService = {
  async getConnection(): Promise<MicrosoftConnection | null> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('microsoft_connections')
      .select('user_id, token_expiry, microsoft_email, display_name, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as MicrosoftConnection | null;
  },

  async isConnected(): Promise<boolean> {
    const connection = await this.getConnection();
    return Boolean(connection?.microsoft_email || connection?.user_id);
  },

  initiateOAuth(returnTo?: string) {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams();
    const resolvedReturnTo =
      returnTo || `${window.location.pathname}${window.location.search || ''}`;
    params.set('returnTo', resolvedReturnTo);

    const query = params.toString();
    window.location.href = query
      ? `/api/auth/microsoft/connect?${query}`
      : '/api/auth/microsoft/connect';
  },

  async refreshAccessToken(_refreshToken?: string, options?: { force?: boolean }) {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const connection = await this.getConnection();
      if (!connection) {
        throw new Error('Microsoft 365 is not connected.');
      }

      if (!options?.force && !tokenNeedsRefresh(connection.token_expiry)) {
        return { success: true, connection, refreshed: false };
      }

      const response = await fetch('/api/auth/microsoft/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: options?.force === true }),
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
    if (!connection) {
      throw new Error('Microsoft 365 is not connected.');
    }

    const response = await fetch('/api/auth/microsoft/access-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: options?.force === true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload?.accessToken !== 'string' || !payload.accessToken) {
      throw new Error(payload?.error || 'Failed to load Microsoft access token.');
    }

    return payload.accessToken;
  },

  async disconnect() {
    const response = await fetch('/api/auth/microsoft/disconnect', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to disconnect Microsoft 365.');
    }

    return { success: true };
  },
};
