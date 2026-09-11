import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';

export type HubSpotTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: string | null;
  portalId?: string | null;
};

async function readSecrets(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('hubspot_integration_secrets')
    .select('access_token_encrypted, refresh_token_encrypted')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    accessToken: data.access_token_encrypted
      ? await decryptIntegrationToken(String(data.access_token_encrypted))
      : '',
    refreshToken: data.refresh_token_encrypted
      ? await decryptIntegrationToken(String(data.refresh_token_encrypted))
      : null,
  };
}

async function writeSecrets(
  admin: SupabaseClient,
  userId: string,
  tokens: { accessToken: string; refreshToken?: string | null }
) {
  const payload: Record<string, string> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (tokens.accessToken) {
    payload.access_token_encrypted = await encryptIntegrationToken(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    payload.refresh_token_encrypted = await encryptIntegrationToken(tokens.refreshToken);
  }
  const { error } = await admin.from('hubspot_integration_secrets').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export async function upsertHubSpotIntegration(params: {
  userId: string;
  tenantId?: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiryDate: string | null;
  portalId?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const safeConfig = {
    portalId: params.portalId || null,
    expiryDate: params.expiryDate,
    lastSync: new Date().toISOString(),
  };

  const row: Record<string, unknown> = {
    user_id: params.userId,
    type: 'hubspot',
    name: 'HubSpot',
    enabled: true,
    config: safeConfig,
  };
  if (params.tenantId) row.tenant_id = params.tenantId;

  const { error } = await admin.from('integrations').upsert(row, { onConflict: 'user_id,type' });
  if (error) throw error;

  await writeSecrets(admin, params.userId, {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
  });
}

export async function getHubSpotTokens(
  admin: SupabaseClient,
  userId: string
): Promise<HubSpotTokens | null> {
  const { data, error } = await admin
    .from('integrations')
    .select('config, enabled')
    .eq('user_id', userId)
    .eq('type', 'hubspot')
    .maybeSingle();
  if (error || !data?.enabled) return null;

  const config = (data.config || {}) as Record<string, unknown>;
  let secrets = await readSecrets(admin, userId);

  if (!secrets) {
    const legacyAccess = config.accessToken || config.access_token;
    const legacyRefresh = config.refreshToken || config.refresh_token;
    if (typeof legacyAccess === 'string' && legacyAccess) {
      await writeSecrets(admin, userId, {
        accessToken: legacyAccess,
        refreshToken: typeof legacyRefresh === 'string' ? legacyRefresh : null,
      });
      await admin
        .from('integrations')
        .update({
          config: {
            portalId: config.portalId || config.portal_id || null,
            expiryDate: config.expiryDate || config.expiry_date || null,
            lastSync: config.lastSync || new Date().toISOString(),
          },
        })
        .eq('user_id', userId)
        .eq('type', 'hubspot');
      secrets = {
        accessToken: legacyAccess,
        refreshToken: typeof legacyRefresh === 'string' ? legacyRefresh : null,
      };
    }
  }

  if (!secrets?.accessToken) return null;

  return {
    accessToken: secrets.accessToken,
    refreshToken: secrets.refreshToken,
    expiryDate: String(config.expiryDate || config.expiry_date || '') || null,
    portalId: (config.portalId || config.portal_id) as string | null,
  };
}

export async function refreshHubSpotAccessToken(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const tokens = await getHubSpotTokens(admin, userId);
  if (!tokens?.refreshToken) throw new Error('HubSpot refresh token missing');

  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: tokens.refreshToken,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'HubSpot token refresh failed');

  const expiresAt = new Date(Date.now() + (data.expires_in || 1800) * 1000).toISOString();
  await upsertHubSpotIntegration({
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken,
    expiryDate: expiresAt,
    portalId: tokens.portalId,
  });

  return data.access_token as string;
}

export async function getValidHubSpotAccessToken(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const tokens = await getHubSpotTokens(admin, userId);
  if (!tokens) throw new Error('HubSpot integration not found');

  const expiry = tokens.expiryDate ? new Date(tokens.expiryDate).getTime() : 0;
  if (!expiry || Date.now() + 5 * 60_000 >= expiry) {
    return refreshHubSpotAccessToken(admin, userId);
  }
  return tokens.accessToken;
}
