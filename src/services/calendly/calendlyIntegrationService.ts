import type { SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';

export type CalendlyPublicConfig = {
  enabled: boolean;
  expiresAt?: string;
  calendlyUserUri: string;
  eventUrl?: string;
  webhookSubscriptionUri?: string;
  webhookUrl?: string;
};

export type CalendlyTenantConfig = CalendlyPublicConfig & {
  accessToken: string;
  refreshToken?: string;
};

async function readSecrets(admin: SupabaseClient, tenantId: string) {
  const { data } = await admin
    .from('calendly_integration_secrets')
    .select('access_token_encrypted, refresh_token_encrypted')
    .eq('integration_id', tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    accessToken: data.access_token_encrypted
      ? await decryptIntegrationToken(String(data.access_token_encrypted))
      : '',
    refreshToken: data.refresh_token_encrypted
      ? await decryptIntegrationToken(String(data.refresh_token_encrypted))
      : undefined,
  };
}

async function writeSecrets(
  admin: SupabaseClient,
  tenantId: string,
  tokens: { accessToken: string; refreshToken?: string | null }
) {
  const payload: Record<string, string> = {
    integration_id: tenantId,
    updated_at: new Date().toISOString(),
  };
  if (tokens.accessToken) {
    payload.access_token_encrypted = await encryptIntegrationToken(tokens.accessToken);
  }
  if (tokens.refreshToken) {
    payload.refresh_token_encrypted = await encryptIntegrationToken(tokens.refreshToken);
  }
  const { error } = await admin
    .from('calendly_integration_secrets')
    .upsert(payload, { onConflict: 'integration_id' });
  if (error) throw new Error(error.message);
}

function publicConfigFromSettings(calendly: Record<string, unknown> | undefined): CalendlyPublicConfig | null {
  if (!calendly?.enabled) return null;
  return {
    enabled: true,
    expiresAt: calendly.expiresAt as string | undefined,
    calendlyUserUri: String(calendly.calendlyUserUri || ''),
    eventUrl: calendly.eventUrl as string | undefined,
    webhookSubscriptionUri: calendly.webhookSubscriptionUri as string | undefined,
    webhookUrl: calendly.webhookUrl as string | undefined,
  };
}

export async function getCalendlyConfig(
  admin: SupabaseClient,
  tenantId: string
): Promise<CalendlyTenantConfig | null> {
  const { data: tenant } = await admin.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
  const settings = (tenant?.settings || {}) as Record<string, unknown>;
  const calendly = settings.calendly as Record<string, unknown> | undefined;
  const publicConfig = publicConfigFromSettings(calendly);
  if (!publicConfig?.calendlyUserUri) return null;

  let secrets = await readSecrets(admin, tenantId);
  if (!secrets?.accessToken && calendly?.accessToken) {
    await writeSecrets(admin, tenantId, {
      accessToken: String(calendly.accessToken),
      refreshToken: calendly.refreshToken ? String(calendly.refreshToken) : null,
    });
    const stripped = { ...publicConfig };
    await admin
      .from('tenants')
      .update({
        settings: {
          ...settings,
          calendly: stripped,
        },
      })
      .eq('id', tenantId);
    secrets = {
      accessToken: String(calendly.accessToken),
      refreshToken: calendly.refreshToken ? String(calendly.refreshToken) : undefined,
    };
  }

  if (!secrets?.accessToken) return null;

  return {
    ...publicConfig,
    accessToken: secrets.accessToken,
    refreshToken: secrets.refreshToken,
  };
}

export async function saveCalendlyIntegration(params: {
  tenantId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: string;
  calendlyUserUri: string;
  eventUrl?: string;
  webhookSubscriptionUri?: string;
  webhookUrl?: string;
}): Promise<CalendlyTenantConfig> {
  const admin = createSupabaseAdminClient();
  const { data: tenant } = await admin.from('tenants').select('settings').eq('id', params.tenantId).single();
  if (!tenant) throw new Error('Tenant not found');

  const publicConfig: CalendlyPublicConfig = {
    enabled: true,
    expiresAt: params.expiresAt,
    calendlyUserUri: params.calendlyUserUri,
    eventUrl: params.eventUrl,
    webhookSubscriptionUri: params.webhookSubscriptionUri,
    webhookUrl: params.webhookUrl,
  };

  const { error } = await admin
    .from('tenants')
    .update({
      settings: {
        ...(tenant.settings || {}),
        calendly: publicConfig,
      },
    })
    .eq('id', params.tenantId);
  if (error) throw error;

  await writeSecrets(admin, params.tenantId, {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
  });

  return {
    ...publicConfig,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken || undefined,
  };
}

export async function refreshCalendlyTokenIfNeeded(
  admin: SupabaseClient,
  tenantId: string
): Promise<CalendlyTenantConfig | null> {
  const config = await getCalendlyConfig(admin, tenantId);
  if (!config?.refreshToken || !config.expiresAt) return config;
  if (new Date(config.expiresAt).getTime() >= Date.now() + 5 * 60_000) return config;

  const clientId = ENV.VITE_CALENDLY_CLIENT_ID || '';
  const clientSecret = ENV.CALENDLY_CLIENT_SECRET || '';
  const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
    }),
  });

  if (!tokenRes.ok) throw new Error('Calendly token expired. Please reconnect.');

  const tokens = await tokenRes.json();
  return saveCalendlyIntegration({
    tenantId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || config.refreshToken,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    calendlyUserUri: config.calendlyUserUri,
    eventUrl: config.eventUrl,
    webhookSubscriptionUri: config.webhookSubscriptionUri,
    webhookUrl: config.webhookUrl,
  });
}
