import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';
import { metaGraphFetch } from '@/lib/meta/metaGraphClient';

export type FacebookIntegrationRow = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  page_id: string;
  page_name: string | null;
  page_access_token?: string | null;
  user_access_token?: string | null;
  app_scoped_user_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

const SAFE_COLUMNS =
  'id, tenant_id, user_id, page_id, page_name, app_scoped_user_id, is_active, expires_at, metadata, connected_at, updated_at';

async function readSecrets(
  admin: SupabaseClient,
  integrationId: string
): Promise<{ pageToken: string | null; userToken: string | null }> {
  const { data } = await admin
    .from('facebook_integration_secrets')
    .select('page_access_token_encrypted, user_access_token_encrypted')
    .eq('integration_id', integrationId)
    .maybeSingle();
  if (!data) return { pageToken: null, userToken: null };
  const pageToken = data.page_access_token_encrypted
    ? await decryptIntegrationToken(String(data.page_access_token_encrypted))
    : null;
  const userToken = data.user_access_token_encrypted
    ? await decryptIntegrationToken(String(data.user_access_token_encrypted))
    : null;
  return { pageToken: pageToken || null, userToken: userToken || null };
}

async function writeSecrets(
  admin: SupabaseClient,
  integrationId: string,
  tokens: { pageToken?: string | null; userToken?: string | null }
): Promise<void> {
  const payload: Record<string, string> = { integration_id: integrationId, updated_at: new Date().toISOString() };
  if (tokens.pageToken) {
    payload.page_access_token_encrypted = await encryptIntegrationToken(tokens.pageToken);
  }
  if (tokens.userToken) {
    payload.user_access_token_encrypted = await encryptIntegrationToken(tokens.userToken);
  }
  const { error } = await admin.from('facebook_integration_secrets').upsert(payload, { onConflict: 'integration_id' });
  if (error) throw new Error(error.message);
}

export function isFacebookTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  return Number.isFinite(exp) && Date.now() >= exp - 60_000;
}

export async function getFacebookTokens(
  admin: SupabaseClient,
  integration: Pick<FacebookIntegrationRow, 'id' | 'expires_at'> & {
    page_access_token?: string | null;
    user_access_token?: string | null;
  }
): Promise<{ pageAccessToken: string | null; userAccessToken: string | null }> {
  const fromSecrets = await readSecrets(admin, integration.id);
  if (fromSecrets.pageToken || fromSecrets.userToken) {
    if (isFacebookTokenExpired(integration.expires_at)) {
      return { pageAccessToken: null, userAccessToken: null };
    }
    return { pageAccessToken: fromSecrets.pageToken, userAccessToken: fromSecrets.userToken };
  }

  const legacyPage = integration.page_access_token
    ? await decryptIntegrationToken(integration.page_access_token)
    : null;
  const legacyUser = integration.user_access_token
    ? await decryptIntegrationToken(integration.user_access_token)
    : null;
  if (!legacyPage && !legacyUser) return { pageAccessToken: null, userAccessToken: null };
  if (isFacebookTokenExpired(integration.expires_at)) {
    return { pageAccessToken: null, userAccessToken: null };
  }

  await writeSecrets(admin, integration.id, { pageToken: legacyPage, userToken: legacyUser }).catch(() => undefined);
  await admin
    .from('facebook_integrations')
    .update({ page_access_token: null, user_access_token: null })
    .eq('id', integration.id);

  return { pageAccessToken: legacyPage, userAccessToken: legacyUser };
}

type FacebookQuery = {
  tenantId?: string;
  userId?: string;
  pageId?: string;
  requireActive?: boolean;
};

export async function getFacebookIntegration(
  admin: SupabaseClient,
  query: FacebookQuery
): Promise<(FacebookIntegrationRow & { page_access_token?: string | null; user_access_token?: string | null }) | null> {
  let q = admin.from('facebook_integrations').select(`${SAFE_COLUMNS}, page_access_token, user_access_token`);
  if (query.tenantId) q = q.eq('tenant_id', query.tenantId);
  if (query.userId) q = q.eq('user_id', query.userId);
  if (query.pageId) q = q.eq('page_id', query.pageId);
  if (query.requireActive !== false) q = q.eq('is_active', true);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data as FacebookIntegrationRow;
}

export async function getFacebookIntegrationWithToken(
  admin: SupabaseClient,
  query: FacebookQuery
): Promise<(FacebookIntegrationRow & { pageAccessToken: string; userAccessToken?: string | null }) | null> {
  const row = await getFacebookIntegration(admin, query);
  if (!row) return null;
  const tokens = await getFacebookTokens(admin, row);
  if (!tokens.pageAccessToken) return null;
  return { ...row, pageAccessToken: tokens.pageAccessToken, userAccessToken: tokens.userAccessToken };
}

export async function upsertFacebookIntegration(params: {
  userId: string;
  tenantId: string | null;
  pageId: string;
  pageName: string | null;
  pageAccessToken: string | null;
  userAccessToken: string;
  appScopedUserId: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
}): Promise<{ integrationId: string | null; error?: string }> {
  const admin = createSupabaseAdminClient();
  const row = {
    user_id: params.userId,
    tenant_id: params.tenantId,
    page_id: params.pageId,
    page_name: params.pageName,
    page_access_token: null,
    user_access_token: null,
    app_scoped_user_id: params.appScopedUserId,
    is_active: true,
    connected_at: new Date().toISOString(),
    expires_at: params.expiresAt,
    metadata: params.metadata,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('facebook_integrations')
    .upsert(row, { onConflict: 'user_id,page_id' })
    .select('id')
    .single();

  if (error || !data?.id) return { integrationId: null, error: error?.message || 'upsert failed' };
  const integrationId = String(data.id);
  await writeSecrets(admin, integrationId, {
    pageToken: params.pageAccessToken,
    userToken: params.userAccessToken,
  });
  return { integrationId };
}

export async function revokeFacebookPermissions(userAccessToken: string): Promise<void> {
  if (!userAccessToken) return;
  await fetch(
    `https://graph.facebook.com/v19.0/me/permissions?access_token=${encodeURIComponent(userAccessToken)}`,
    { method: 'DELETE' }
  ).catch(() => undefined);
}

export async function deleteFacebookIntegration(params: {
  userId: string;
  pageId: string;
  tenantId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const row = await getFacebookIntegration(admin, {
    userId: params.userId,
    pageId: params.pageId,
    tenantId: params.tenantId,
    requireActive: false,
  });
  if (row) {
    const tokens = await getFacebookTokens(admin, row);
    if (tokens.userAccessToken) await revokeFacebookPermissions(tokens.userAccessToken);
  }

  let q = admin.from('facebook_integrations').delete().eq('user_id', params.userId).eq('page_id', params.pageId);
  if (params.tenantId) q = q.eq('tenant_id', params.tenantId);
  const { error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markFacebookIntegrationInactive(
  admin: SupabaseClient,
  integrationId: string,
  reason: string
): Promise<void> {
  const { data: row } = await admin
    .from('facebook_integrations')
    .select('metadata')
    .eq('id', integrationId)
    .maybeSingle();
  const metadata =
    row?.metadata && typeof row.metadata === 'object'
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  await admin
    .from('facebook_integrations')
    .update({
      is_active: false,
      metadata: { ...metadata, inactive_reason: reason, inactive_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);
}

export async function runFacebookTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  deactivated: number;
  expiringSoon: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: rows } = await admin
    .from('facebook_integrations')
    .select(`${SAFE_COLUMNS}, page_access_token, user_access_token`)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  let deactivated = 0;
  let expiringSoon = 0;

  for (const row of rows || []) {
    const integration = row as FacebookIntegrationRow;
    if (integration.expires_at) {
      const exp = new Date(integration.expires_at);
      if (exp.getTime() <= now.getTime()) {
        await markFacebookIntegrationInactive(admin, integration.id, 'token_expired');
        deactivated++;
        continue;
      }
      if (exp.getTime() <= soon.getTime()) expiringSoon++;
    }

    const tokens = await getFacebookTokens(admin, integration);
    if (!tokens.pageAccessToken) continue;

    try {
      const res = await metaGraphFetch(
        `${integration.page_id}?fields=id,name`,
        tokens.pageAccessToken,
        { method: 'GET' },
        { retries: 1, timeoutMs: 15000 }
      );
      if (res.status === 401 || res.status === 403) {
        await markFacebookIntegrationInactive(admin, integration.id, 'token_revoked_or_invalid');
        deactivated++;
      }
    } catch {
      // transient
    }
  }

  return { checked: rows?.length || 0, deactivated, expiringSoon };
}
