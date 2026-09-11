import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';
import { metaGraphFetch } from '@/lib/meta/metaGraphClient';
import { isFacebookTokenExpired } from '@/services/facebook/facebookIntegrationService';

export type InstagramIntegrationRow = {
  id: string;
  tenant_id: string | null;
  user_id: string;
  instagram_account_id: string;
  username: string | null;
  account_name: string | null;
  facebook_page_id: string | null;
  page_access_token?: string | null;
  is_active: boolean;
  expires_at: string | null;
};

const SAFE_COLUMNS =
  'id, tenant_id, user_id, instagram_account_id, username, account_name, facebook_page_id, is_active, expires_at, connected_at, updated_at';

async function readToken(admin: SupabaseClient, integrationId: string): Promise<string | null> {
  const { data } = await admin
    .from('instagram_integration_secrets')
    .select('page_access_token_encrypted')
    .eq('integration_id', integrationId)
    .maybeSingle();
  if (!data?.page_access_token_encrypted) return null;
  const plain = await decryptIntegrationToken(String(data.page_access_token_encrypted));
  return plain || null;
}

async function writeToken(admin: SupabaseClient, integrationId: string, pageAccessToken: string): Promise<void> {
  const encrypted = await encryptIntegrationToken(pageAccessToken);
  const { error } = await admin.from('instagram_integration_secrets').upsert(
    {
      integration_id: integrationId,
      page_access_token_encrypted: encrypted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'integration_id' }
  );
  if (error) throw new Error(error.message);
}

export async function getInstagramPageAccessToken(
  admin: SupabaseClient,
  integration: Pick<InstagramIntegrationRow, 'id' | 'expires_at' | 'page_access_token'>
): Promise<string | null> {
  const fromSecrets = await readToken(admin, integration.id);
  if (fromSecrets) {
    if (isFacebookTokenExpired(integration.expires_at)) return null;
    return fromSecrets;
  }

  const legacy = integration.page_access_token
    ? await decryptIntegrationToken(integration.page_access_token)
    : null;
  if (!legacy) return null;
  if (isFacebookTokenExpired(integration.expires_at)) return null;

  await writeToken(admin, integration.id, legacy).catch(() => undefined);
  await admin.from('instagram_integrations').update({ page_access_token: null }).eq('id', integration.id);
  return legacy;
}

export async function getInstagramIntegration(
  admin: SupabaseClient,
  query: { tenantId?: string; userId?: string; instagramAccountId?: string; requireActive?: boolean }
): Promise<InstagramIntegrationRow | null> {
  let q = admin.from('instagram_integrations').select(`${SAFE_COLUMNS}, page_access_token`);
  if (query.tenantId) q = q.eq('tenant_id', query.tenantId);
  if (query.userId) q = q.eq('user_id', query.userId);
  if (query.instagramAccountId) q = q.eq('instagram_account_id', query.instagramAccountId);
  if (query.requireActive !== false) q = q.eq('is_active', true);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data as InstagramIntegrationRow;
}

export async function getInstagramIntegrationWithToken(
  admin: SupabaseClient,
  query: { tenantId?: string; userId?: string; instagramAccountId?: string }
): Promise<(InstagramIntegrationRow & { pageAccessToken: string }) | null> {
  const row = await getInstagramIntegration(admin, query);
  if (!row) return null;
  const pageAccessToken = await getInstagramPageAccessToken(admin, row);
  if (!pageAccessToken) return null;
  return { ...row, pageAccessToken };
}

export async function upsertInstagramIntegration(params: {
  userId: string;
  tenantId: string | null;
  instagramAccountId: string;
  username: string | null;
  accountName: string | null;
  profilePictureUrl: string | null;
  facebookPageId: string;
  facebookPageName: string;
  pageAccessToken: string;
  followersCount: number;
  mediaCount: number;
  expiresAt: string | null;
}): Promise<{ integrationId: string | null; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('instagram_integrations')
    .upsert(
      {
        user_id: params.userId,
        tenant_id: params.tenantId,
        instagram_account_id: params.instagramAccountId,
        username: params.username,
        account_name: params.accountName,
        profile_picture_url: params.profilePictureUrl,
        facebook_page_id: params.facebookPageId,
        facebook_page_name: params.facebookPageName,
        followers_count: params.followersCount,
        media_count: params.mediaCount,
        page_access_token: null,
        is_active: true,
        connected_at: new Date().toISOString(),
        expires_at: params.expiresAt,
      },
      { onConflict: 'user_id,instagram_account_id' }
    )
    .select('id')
    .single();

  if (error || !data?.id) return { integrationId: null, error: error?.message || 'upsert failed' };
  await writeToken(admin, String(data.id), params.pageAccessToken);
  return { integrationId: String(data.id) };
}

export async function markInstagramIntegrationInactive(
  admin: SupabaseClient,
  integrationId: string,
  reason: string
): Promise<void> {
  await admin
    .from('instagram_integrations')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);
  void reason;
}

export async function runInstagramTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  deactivated: number;
  expiringSoon: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: rows } = await admin
    .from('instagram_integrations')
    .select(`${SAFE_COLUMNS}, page_access_token`)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  let deactivated = 0;
  let expiringSoon = 0;

  for (const row of rows || []) {
    const integration = row as InstagramIntegrationRow;
    if (integration.expires_at) {
      const exp = new Date(integration.expires_at);
      if (exp.getTime() <= now.getTime()) {
        await markInstagramIntegrationInactive(admin, integration.id, 'token_expired');
        deactivated++;
        continue;
      }
      if (exp.getTime() <= soon.getTime()) expiringSoon++;
    }

    const token = await getInstagramPageAccessToken(admin, integration);
    if (!token) continue;

    try {
      const res = await metaGraphFetch(
        `${integration.instagram_account_id}?fields=id,username`,
        token,
        { method: 'GET' },
        { retries: 1, timeoutMs: 15000 }
      );
      if (res.status === 401 || res.status === 403) {
        await markInstagramIntegrationInactive(admin, integration.id, 'token_revoked_or_invalid');
        deactivated++;
      }
    } catch {
      // transient
    }
  }

  return { checked: rows?.length || 0, deactivated, expiringSoon };
}
