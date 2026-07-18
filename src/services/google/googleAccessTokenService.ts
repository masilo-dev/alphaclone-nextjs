import type { SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { getGoogleCalendarTokens, upsertGoogleCalendarTokens } from './googleCalendarIntegrationService';

export async function getValidGoogleAccessToken(params: {
  admin: SupabaseClient;
  userId: string;
  tenantId: string;
}): Promise<string | null> {
  const tokens = await getGoogleCalendarTokens(params.admin, params.userId, params.tenantId);
  if (!tokens.accessToken && !tokens.refreshToken) return null;
  if (tokens.accessToken && tokens.expiresAt && new Date(tokens.expiresAt).getTime() > Date.now() + 300_000) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken || !ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google authorization expired. Reconnect Google Workspace.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: ENV.GOOGLE_CLIENT_ID,
      client_secret: ENV.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || 'Google authorization could not be refreshed.');
  const accessToken = String(payload.access_token);
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
  await upsertGoogleCalendarTokens({ userId: params.userId, tenantId: params.tenantId, accessToken, refreshToken: tokens.refreshToken, expiresAt });
  return accessToken;
}
