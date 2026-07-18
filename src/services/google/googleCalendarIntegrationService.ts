import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';

export type GoogleCalendarTokenRow = {
  user_id: string;
  expires_at: string | null;
  last_synced_at: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
};

const SAFE_COLUMNS = 'user_id, expires_at, last_synced_at';

async function readSecrets(
  admin: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const { data } = await admin
    .from('google_calendar_secrets')
    .select('access_token_encrypted, refresh_token_encrypted')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
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
  tenantId: string,
  tokens: { accessToken?: string | null; refreshToken?: string | null }
): Promise<void> {
  const payload: Record<string, string> = {
    user_id: userId,
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };
  if (tokens.accessToken) {
    payload.access_token_encrypted = await encryptIntegrationToken(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    payload.refresh_token_encrypted = await encryptIntegrationToken(tokens.refreshToken);
  }
  const { error } = await admin.from('google_calendar_secrets').upsert(payload, { onConflict: 'tenant_id,user_id' });
  if (error) throw new Error(error.message);
}

async function migrateLegacy(
  admin: SupabaseClient,
  row: GoogleCalendarTokenRow,
  tenantId: string
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const accessToken = row.access_token ? await decryptIntegrationToken(row.access_token) : null;
  const refreshToken = row.refresh_token ? await decryptIntegrationToken(row.refresh_token) : null;
  if (!accessToken && !refreshToken) return { accessToken: null, refreshToken: null };
  await writeSecrets(admin, row.user_id, tenantId, { accessToken, refreshToken });
  await admin
    .from('google_calendar_tokens')
    .update({ access_token: null, refresh_token: null })
    .eq('user_id', row.user_id)
    .eq('tenant_id', tenantId);

  return { accessToken, refreshToken };
}

export async function upsertGoogleCalendarTokens(params: {
  userId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('google_calendar_tokens').upsert(
    {
      user_id: params.userId,
      tenant_id: params.tenantId,
      access_token: null,
      refresh_token: null,
      expires_at: params.expiresAt,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,user_id' }
  );
  if (error) throw error;
  await writeSecrets(admin, params.userId, params.tenantId, {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
  });
}

export async function getGoogleCalendarTokens(
  admin: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<{ accessToken: string | null; refreshToken: string | null; expiresAt: string | null }> {
  const { data, error } = await admin
    .from('google_calendar_tokens')
    .select(`${SAFE_COLUMNS}, access_token, refresh_token`)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) return { accessToken: null, refreshToken: null, expiresAt: null };
  const row = data as GoogleCalendarTokenRow;
  let secrets = await readSecrets(admin, userId, tenantId);
  if (!secrets.accessToken && !secrets.refreshToken && (row.access_token || row.refresh_token)) {
    secrets = await migrateLegacy(admin, row, tenantId);
  }
  return { ...secrets, expiresAt: row.expires_at };
}

export async function runGoogleCalendarTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  expired: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const { data: rows } = await admin.from('google_calendar_tokens').select('user_id, expires_at').limit(limit);
  let expired = 0;
  for (const row of rows || []) {
    const exp = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0;
    if (!exp || exp <= now) expired++;
  }
  return { checked: (rows || []).length, expired };
}
