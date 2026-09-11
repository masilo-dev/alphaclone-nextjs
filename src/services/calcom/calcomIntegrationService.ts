import type { SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';

/** Cal.com OAuth base URLs */
export const CALCOM_BASE_URL = 'https://app.cal.com';
export const CALCOM_API_BASE = 'https://api.cal.com/v2';

export type CalcomTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;       // ISO string
  calcomUserId?: number;
  email?: string;
  username?: string;
};

/** Config stored per tenant — returned to callers (tokens encrypted at rest). */
export type CalcomTenantConfig = CalcomTokens & {
  connected: boolean;
};

// ─── Token storage helpers ────────────────────────────────────────────────────

async function readCalcomTokens(
  admin: SupabaseClient,
  tenantId: string
): Promise<CalcomTokens | null> {
  const { data } = await admin
    .from('integrations')
    .select('config, enabled')
    .eq('tenant_id', tenantId)
    .eq('type', 'calcom')
    .maybeSingle();

  if (!data?.enabled || !data?.config) return null;

  const cfg = data.config as Record<string, unknown>;
  const accessToken = cfg.access_token_encrypted
    ? await decryptIntegrationToken(String(cfg.access_token_encrypted))
    : '';
  const refreshToken = cfg.refresh_token_encrypted
    ? await decryptIntegrationToken(String(cfg.refresh_token_encrypted))
    : '';

  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken,
    expiresAt: String(cfg.expires_at || ''),
    calcomUserId: cfg.calcom_user_id ? Number(cfg.calcom_user_id) : undefined,
    email: cfg.email ? String(cfg.email) : undefined,
    username: cfg.username ? String(cfg.username) : undefined,
  };
}

async function writeCalcomTokens(
  admin: SupabaseClient,
  tenantId: string,
  tokens: CalcomTokens
): Promise<void> {
  const encryptedAccess = await encryptIntegrationToken(tokens.accessToken);
  const encryptedRefresh = tokens.refreshToken
    ? await encryptIntegrationToken(tokens.refreshToken)
    : null;

  const config: Record<string, unknown> = {
    access_token_encrypted: encryptedAccess,
    expires_at: tokens.expiresAt,
    calcom_user_id: tokens.calcomUserId ?? null,
    email: tokens.email ?? null,
    username: tokens.username ?? null,
    updated_at: new Date().toISOString(),
  };
  if (encryptedRefresh) {
    config.refresh_token_encrypted = encryptedRefresh;
  }

  const { error } = await admin.from('integrations').upsert(
    {
      tenant_id: tenantId,
      type: 'calcom',
      enabled: true,
      config,
    },
    { onConflict: 'tenant_id,type' }
  );
  if (error) throw new Error(`[calcom] Failed to store tokens: ${error.message}`);
}

// ─── OAuth token exchange ────────────────────────────────────────────────────

export async function exchangeCalcomCode(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
}> {
  const clientId = ENV.CAL_OAUTH_CLIENT_ID;
  const clientSecret = ENV.CAL_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Cal.com OAuth is not configured — CAL_OAUTH_CLIENT_ID / CAL_OAUTH_CLIENT_SECRET missing');
  }

  // Cal.com uses HTTP Basic auth for token exchange
  const resp = await fetch(`${CALCOM_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
    signal: AbortSignal.timeout(12_000),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.error) {
    throw new Error(
      `Cal.com token exchange failed (${resp.status}): ${data?.error_description || data?.error || 'Unknown error'}`
    );
  }
  return data;
}

// ─── Fetch Cal.com user info ─────────────────────────────────────────────────

export async function fetchCalcomMe(accessToken: string): Promise<{
  id: number;
  email: string;
  username: string;
}> {
  const resp = await fetch(`${CALCOM_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Cal.com /me failed (${resp.status}): ${data?.message || 'Unknown error'}`);
  }
  // v2 API wraps in { data: { user: { ... } } } or { user: { ... } }
  const user = data?.data?.user ?? data?.user ?? data;
  return {
    id: Number(user?.id ?? 0),
    email: String(user?.email ?? ''),
    username: String(user?.username ?? ''),
  };
}

// ─── Token refresh ────────────────────────────────────────────────────────────

export async function refreshCalcomToken(
  admin: SupabaseClient,
  tenantId: string
): Promise<string> {
  const existing = await readCalcomTokens(admin, tenantId);
  if (!existing?.refreshToken) {
    throw new Error('[calcom] No refresh token — user must reconnect');
  }

  const clientId = ENV.CAL_OAUTH_CLIENT_ID;
  const clientSecret = ENV.CAL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('[calcom] CAL_OAUTH_CLIENT_ID / CAL_OAUTH_CLIENT_SECRET not set');
  }

  const resp = await fetch(`${CALCOM_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: existing.refreshToken,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.error) {
    throw new Error(
      `Cal.com refresh failed: ${data?.error_description || data?.error || resp.status}`
    );
  }

  const newTokens: CalcomTokens = {
    ...existing,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existing.refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  };
  await writeCalcomTokens(admin, tenantId, newTokens);
  return newTokens.accessToken;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCalcomConfig(
  admin: SupabaseClient,
  tenantId: string
): Promise<CalcomTenantConfig | null> {
  const tokens = await readCalcomTokens(admin, tenantId);
  if (!tokens) return null;
  return { ...tokens, connected: true };
}

export async function saveCalcomIntegration(
  admin: SupabaseClient,
  tenantId: string,
  tokens: CalcomTokens
): Promise<void> {
  await writeCalcomTokens(admin, tenantId, tokens);

  // Log to tenant_integrations for dashboard status pill
  await admin.from('tenant_integrations').upsert(
    {
      tenant_id: tenantId,
      integration_id: 'calcom',
      status: 'connected',
      connected_at: new Date().toISOString(),
      metadata: {
        calcomUserId: tokens.calcomUserId,
        email: tokens.email,
        username: tokens.username,
      },
    },
    { onConflict: 'tenant_id,integration_id' }
  );
}

export async function disconnectCalcomIntegration(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  await admin.from('integrations').delete().eq('tenant_id', tenantId).eq('type', 'calcom');
  await admin
    .from('tenant_integrations')
    .update({ status: 'disconnected', metadata: {} })
    .eq('tenant_id', tenantId)
    .eq('integration_id', 'calcom');
}
