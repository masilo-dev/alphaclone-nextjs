import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';
import { metaGraphFetch } from '@/lib/meta/metaGraphClient';

export type WhatsAppIntegrationRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  waba_id: string;
  phone_number_id: string;
  access_token?: string | null;
  is_active: boolean;
  webhook_verified: boolean | null;
  metadata: Record<string, unknown> | null;
};

const SAFE_COLUMNS =
  'id, tenant_id, user_id, waba_id, phone_number_id, is_active, webhook_verified, metadata, created_at, updated_at';

async function readToken(admin: SupabaseClient, integrationId: string): Promise<string | null> {
  const { data } = await admin
    .from('whatsapp_integration_secrets')
    .select('access_token_encrypted')
    .eq('integration_id', integrationId)
    .maybeSingle();
  if (!data?.access_token_encrypted) return null;
  const plain = await decryptIntegrationToken(String(data.access_token_encrypted));
  return plain || null;
}

async function writeToken(admin: SupabaseClient, integrationId: string, accessToken: string): Promise<void> {
  const encrypted = await encryptIntegrationToken(accessToken);
  const { error } = await admin.from('whatsapp_integration_secrets').upsert(
    {
      integration_id: integrationId,
      access_token_encrypted: encrypted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'integration_id' }
  );
  if (error) throw new Error(error.message);
}

export async function getWhatsAppAccessToken(
  admin: SupabaseClient,
  integration: Pick<WhatsAppIntegrationRow, 'id' | 'access_token'>
): Promise<string | null> {
  const fromSecrets = await readToken(admin, integration.id);
  if (fromSecrets) return fromSecrets;

  const legacy = integration.access_token ? await decryptIntegrationToken(integration.access_token) : null;
  if (!legacy) return null;

  await writeToken(admin, integration.id, legacy).catch(() => undefined);
  await admin.from('whatsapp_integrations').update({ access_token: null }).eq('id', integration.id);
  return legacy;
}

export async function getWhatsAppIntegration(
  admin: SupabaseClient,
  query: { tenantId: string; integrationId?: string; phoneNumberId?: string; requireActive?: boolean }
): Promise<WhatsAppIntegrationRow | null> {
  let q = admin
    .from('whatsapp_integrations')
    .select(`${SAFE_COLUMNS}, access_token`)
    .eq('tenant_id', query.tenantId);
  if (query.integrationId) q = q.eq('id', query.integrationId);
  if (query.phoneNumberId) q = q.eq('phone_number_id', query.phoneNumberId);
  if (query.requireActive !== false) q = q.eq('is_active', true);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data as WhatsAppIntegrationRow;
}

export async function getWhatsAppIntegrationWithToken(
  admin: SupabaseClient,
  query: { tenantId: string; integrationId?: string; phoneNumberId?: string }
): Promise<(WhatsAppIntegrationRow & { accessToken: string }) | null> {
  const row = await getWhatsAppIntegration(admin, query);
  if (!row?.phone_number_id) return null;
  const accessToken = await getWhatsAppAccessToken(admin, row);
  if (!accessToken) return null;
  return { ...row, accessToken };
}

export async function upsertWhatsAppIntegration(params: {
  tenantId: string;
  userId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  webhookVerified: boolean;
  metadata: Record<string, unknown>;
}): Promise<{ integrationId: string | null; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('whatsapp_integrations')
    .upsert(
      {
        tenant_id: params.tenantId,
        user_id: params.userId,
        waba_id: params.wabaId,
        phone_number_id: params.phoneNumberId,
        access_token: null,
        is_active: true,
        webhook_verified: params.webhookVerified,
        metadata: params.metadata,
      },
      { onConflict: 'tenant_id,waba_id' }
    )
    .select('id')
    .single();

  if (error || !data?.id) return { integrationId: null, error: error?.message || 'upsert failed' };
  await writeToken(admin, String(data.id), params.accessToken);
  return { integrationId: String(data.id) };
}

export async function deleteWhatsAppIntegration(params: {
  tenantId: string;
  integrationId: string;
}): Promise<{ success: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('whatsapp_integrations')
    .delete()
    .eq('tenant_id', params.tenantId)
    .eq('id', params.integrationId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markWhatsAppIntegrationInactive(
  admin: SupabaseClient,
  integrationId: string,
  reason: string
): Promise<void> {
  const { data: row } = await admin
    .from('whatsapp_integrations')
    .select('metadata')
    .eq('id', integrationId)
    .maybeSingle();
  const metadata =
    row?.metadata && typeof row.metadata === 'object'
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  await admin
    .from('whatsapp_integrations')
    .update({
      is_active: false,
      metadata: { ...metadata, inactive_reason: reason, inactive_at: new Date().toISOString() },
    })
    .eq('id', integrationId);
}

export async function runWhatsAppTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  deactivated: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from('whatsapp_integrations')
    .select(`${SAFE_COLUMNS}, access_token`)
    .eq('is_active', true)
    .not('phone_number_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  let deactivated = 0;
  for (const row of rows || []) {
    const integration = row as WhatsAppIntegrationRow;
    const token = await getWhatsAppAccessToken(admin, integration);
    if (!token) continue;
    try {
      const res = await metaGraphFetch(
        `${integration.phone_number_id}?fields=id,display_phone_number`,
        token,
        { method: 'GET' },
        { graphVersion: 'v18.0', retries: 1, timeoutMs: 15000 }
      );
      if (res.status === 401 || res.status === 403) {
        await markWhatsAppIntegrationInactive(admin, integration.id, 'token_revoked_or_invalid');
        deactivated++;
      }
    } catch {
      // transient
    }
  }
  return { checked: rows?.length || 0, deactivated };
}
