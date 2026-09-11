import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
} from '@/lib/integration/integrationTokenCrypto';

export type SlackIntegrationRow = {
  id: string;
  tenant_id: string;
  team_id: string | null;
  team_name: string | null;
  bot_user_id: string | null;
  default_channel: string | null;
  scope: string | null;
  is_active: boolean;
  connected_at: string | null;
  updated_at: string | null;
  bot_access_token?: string | null;
  user_access_token?: string | null;
  webhook_url?: string | null;
};

const SAFE_COLUMNS =
  'id, tenant_id, team_id, team_name, bot_user_id, default_channel, scope, is_active, connected_at, updated_at';

async function readSecrets(
  admin: SupabaseClient,
  integrationId: string
): Promise<{ botToken: string | null; userToken: string | null; webhookUrl: string | null }> {
  const { data } = await admin
    .from('slack_integration_secrets')
    .select('bot_access_token_encrypted, user_access_token_encrypted, webhook_url_encrypted')
    .eq('integration_id', integrationId)
    .maybeSingle();
  if (!data) return { botToken: null, userToken: null, webhookUrl: null };
  const botToken = data.bot_access_token_encrypted
    ? await decryptIntegrationToken(String(data.bot_access_token_encrypted))
    : null;
  const userToken = data.user_access_token_encrypted
    ? await decryptIntegrationToken(String(data.user_access_token_encrypted))
    : null;
  const webhookUrl = data.webhook_url_encrypted
    ? await decryptIntegrationToken(String(data.webhook_url_encrypted))
    : null;
  return { botToken: botToken || null, userToken: userToken || null, webhookUrl: webhookUrl || null };
}

async function writeSecrets(
  admin: SupabaseClient,
  integrationId: string,
  tokens: { botToken?: string | null; userToken?: string | null; webhookUrl?: string | null }
): Promise<void> {
  const payload: Record<string, string> = {
    integration_id: integrationId,
    updated_at: new Date().toISOString(),
  };
  if (tokens.botToken) {
    payload.bot_access_token_encrypted = await encryptIntegrationToken(tokens.botToken);
  }
  if (tokens.userToken) {
    payload.user_access_token_encrypted = await encryptIntegrationToken(tokens.userToken);
  }
  if (tokens.webhookUrl) {
    payload.webhook_url_encrypted = await encryptIntegrationToken(tokens.webhookUrl);
  }
  const { error } = await admin.from('slack_integration_secrets').upsert(payload, { onConflict: 'integration_id' });
  if (error) throw new Error(error.message);
}

async function migrateLegacyTokens(
  admin: SupabaseClient,
  row: SlackIntegrationRow
): Promise<{ botToken: string | null; userToken: string | null; webhookUrl: string | null }> {
  const legacyBot = row.bot_access_token ? await decryptIntegrationToken(row.bot_access_token) : null;
  const legacyUser = row.user_access_token ? await decryptIntegrationToken(row.user_access_token) : null;
  const legacyWebhook = row.webhook_url ? await decryptIntegrationToken(row.webhook_url) : null;
  if (!legacyBot && !legacyUser && !legacyWebhook) {
    return { botToken: null, userToken: null, webhookUrl: null };
  }
  await writeSecrets(admin, row.id, {
    botToken: legacyBot,
    userToken: legacyUser,
    webhookUrl: legacyWebhook,
  });
  await admin
    .from('slack_integrations')
    .update({ bot_access_token: null, user_access_token: null, webhook_url: null })
    .eq('id', row.id);
  return { botToken: legacyBot, userToken: legacyUser, webhookUrl: legacyWebhook };
}

export async function getSlackIntegration(
  admin: SupabaseClient,
  tenantId: string
): Promise<SlackIntegrationRow | null> {
  const { data, error } = await admin
    .from('slack_integrations')
    .select(SAFE_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as SlackIntegrationRow;
}

export async function getSlackIntegrationWithSecrets(
  admin: SupabaseClient,
  tenantId: string
): Promise<(SlackIntegrationRow & { botAccessToken: string | null; webhookUrl: string | null }) | null> {
  const { data, error } = await admin
    .from('slack_integrations')
    .select(SAFE_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as SlackIntegrationRow;
  const secrets = await readSecrets(admin, row.id);
  return { ...row, botAccessToken: secrets.botToken, webhookUrl: secrets.webhookUrl };
}

export async function upsertSlackIntegration(params: {
  tenantId: string;
  teamId: string;
  teamName: string | null;
  botUserId: string | null;
  botAccessToken: string;
  userAccessToken?: string | null;
  webhookUrl?: string | null;
  defaultChannel?: string | null;
  scope?: string | null;
}): Promise<{ integrationId: string | null; error?: string }> {
  const admin = createSupabaseAdminClient();
  // Keep tokens out of slack_integrations — secrets live in slack_integration_secrets.
  // Do not write legacy plaintext columns that may be missing on older schemas.
  const row = {
    tenant_id: params.tenantId,
    team_id: params.teamId,
    team_name: params.teamName,
    bot_user_id: params.botUserId,
    default_channel: params.defaultChannel || '#general',
    scope: params.scope || null,
    is_active: true,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('slack_integrations')
    .upsert(row, { onConflict: 'tenant_id' })
    .select('id')
    .single();

  if (error || !data?.id) return { integrationId: null, error: error?.message || 'upsert failed' };
  const integrationId = String(data.id);
  await writeSecrets(admin, integrationId, {
    botToken: params.botAccessToken,
    userToken: params.userAccessToken ?? null,
    webhookUrl: params.webhookUrl ?? null,
  });
  return { integrationId };
}

export async function runSlackTokenHealthCheck(limit = 50): Promise<{
  checked: number;
  needsReconnect: number;
}> {
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from('slack_integrations')
    .select(SAFE_COLUMNS)
    .eq('is_active', true)
    .limit(limit);

  let needsReconnect = 0;
  for (const row of rows || []) {
    const withSecrets = await getSlackIntegrationWithSecrets(admin, String(row.tenant_id));
    if (!withSecrets?.botAccessToken && !withSecrets?.webhookUrl) {
      await admin
        .from('slack_integrations')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      needsReconnect++;
    }
  }
  return { checked: (rows || []).length, needsReconnect };
}
