import type { SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';

export type MicrosoftConnectionRow = {
  user_id: string;
  token_expiry: string | null;
  microsoft_email: string | null;
  display_name: string | null;
  updated_at: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
};

const SAFE_COLUMNS = 'user_id, token_expiry, microsoft_email, display_name, updated_at';

async function readSecrets(
  admin: SupabaseClient,
  userId: string
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const { data } = await admin
    .from('microsoft_connection_secrets')
    .select('access_token_encrypted, refresh_token_encrypted')
    .eq('connection_user_id', userId)
    .maybeSingle();
  if (!data) return { accessToken: null, refreshToken: null };
  const accessToken = data.access_token_encrypted
    ? await decryptIntegrationToken(String(data.access_token_encrypted))
    : null;
  const refreshToken = data.refresh_token_encrypted
    ? await decryptIntegrationToken(String(data.refresh_token_encrypted))
    : null;
  return { accessToken: accessToken || null, refreshToken: refreshToken || null };
}

async function writeSecrets(
  admin: SupabaseClient,
  userId: string,
  tokens: { accessToken?: string | null; refreshToken?: string | null }
): Promise<void> {
  const payload: Record<string, string> = {
    connection_user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (tokens.accessToken) {
    payload.access_token_encrypted = await encryptIntegrationToken(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    payload.refresh_token_encrypted = await encryptIntegrationToken(tokens.refreshToken);
  }
  const { error } = await admin
    .from('microsoft_connection_secrets')
    .upsert(payload, { onConflict: 'connection_user_id' });
  if (error) throw new Error(error.message);
}

async function migrateLegacyTokens(
  admin: SupabaseClient,
  row: MicrosoftConnectionRow
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const accessToken = row.access_token ? await decryptIntegrationToken(row.access_token) : null;
  const refreshToken = row.refresh_token ? await decryptIntegrationToken(row.refresh_token) : null;
  if (!accessToken && !refreshToken) return { accessToken: null, refreshToken: null };
  await writeSecrets(admin, row.user_id, { accessToken, refreshToken });
  await admin
    .from('microsoft_connections')
    .update({ access_token: null, refresh_token: null })
    .eq('user_id', row.user_id);
  return { accessToken, refreshToken };
}

export async function getMicrosoftConnection(
  admin: SupabaseClient,
  userId: string
): Promise<MicrosoftConnectionRow | null> {
  const { data, error } = await admin
    .from('microsoft_connections')
    .select(SAFE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as MicrosoftConnectionRow;
}

export async function getMicrosoftTokens(
  admin: SupabaseClient,
  userId: string
): Promise<{ accessToken: string | null; refreshToken: string | null; connection: MicrosoftConnectionRow | null }> {
  const { data, error } = await admin
    .from('microsoft_connections')
    .select(`${SAFE_COLUMNS}, access_token, refresh_token`)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { accessToken: null, refreshToken: null, connection: null };
  const row = data as MicrosoftConnectionRow;
  let secrets = await readSecrets(admin, userId);
  if (!secrets.accessToken && !secrets.refreshToken && (row.access_token || row.refresh_token)) {
    secrets = await migrateLegacyTokens(admin, row);
  }
  return { ...secrets, connection: row };
}

export async function upsertMicrosoftConnection(params: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: string | null;
  microsoftEmail: string | null;
  displayName: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('microsoft_connections').upsert(
    {
      user_id: params.userId,
      access_token: null,
      refresh_token: null,
      token_expiry: params.tokenExpiry,
      microsoft_email: params.microsoftEmail,
      display_name: params.displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
  await writeSecrets(admin, params.userId, {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
  });
}

export async function refreshMicrosoftAccessToken(
  admin: SupabaseClient,
  userId: string,
  options?: { force?: boolean }
): Promise<{ accessToken: string; refreshed: boolean }> {
  const { accessToken, refreshToken, connection } = await getMicrosoftTokens(admin, userId);
  if (!connection) throw new Error('No Microsoft connection found.');
  if (!refreshToken) throw new Error('No Microsoft refresh token available.');

  const expiresAt = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0;
  const needsRefresh =
    options?.force ||
    !connection.token_expiry ||
    Number.isNaN(expiresAt) ||
    Date.now() + 5 * 60 * 1000 >= expiresAt;

  if (!needsRefresh && accessToken) {
    return { accessToken, refreshed: false };
  }

  const clientId = ENV.AZURE_CLIENT_ID || ENV.VITE_AZURE_CLIENT_ID;
  const clientSecret = ENV.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    if (accessToken) return { accessToken, refreshed: false };
    throw new Error('Microsoft OAuth is not configured on the server.');
  }

  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    throw new Error(tokenPayload?.error_description || tokenPayload?.error || 'Microsoft refresh failed');
  }

  const newExpiry = tokenPayload.expires_in
    ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
    : connection.token_expiry;

  await admin
    .from('microsoft_connections')
    .update({
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  await writeSecrets(admin, userId, {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || refreshToken,
  });

  return { accessToken: tokenPayload.access_token as string, refreshed: true };
}

export async function runMicrosoftTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  expired: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const { data: rows } = await admin
    .from('microsoft_connections')
    .select('user_id, token_expiry')
    .limit(limit);

  let expired = 0;
  for (const row of rows || []) {
    const exp = row.token_expiry ? new Date(String(row.token_expiry)).getTime() : 0;
    if (!exp || exp <= now) {
      expired++;
      try {
        await refreshMicrosoftAccessToken(admin, String(row.user_id));
      } catch {
        // user must reconnect
      }
    }
  }
  return { checked: (rows || []).length, expired };
}
