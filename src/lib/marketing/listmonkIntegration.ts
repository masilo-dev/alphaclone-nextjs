import type { SupabaseClient } from '@supabase/supabase-js';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import {
  createListmonkCampaign,
  createListmonkList,
  createListmonkSubscriber,
  setListmonkSubscriberBlocklist,
} from '@/lib/marketing/listmonkClient';

type OperationClaim = {
  duplicate: boolean;
  ledgerId: string;
  existingResult?: Record<string, unknown>;
};

async function assertEnabled(admin: SupabaseClient, tenantId: string) {
  const enabled = await isExecutionFeatureEnabled(admin, 'LISTMONK_ENABLED', tenantId);
  if (!enabled) throw new Error('Listmonk is not enabled for this workspace');
}

async function claimOperation(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    idempotencyKey: string;
    operation: string;
    entityType?: string;
    entityId?: string;
    correlationId?: string;
    requestSummary?: Record<string, unknown>;
  },
): Promise<OperationClaim> {
  const { data, error } = await admin
    .from('listmonk_operation_ledger')
    .insert({
      tenant_id: input.tenantId,
      idempotency_key: input.idempotencyKey,
      operation: input.operation,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      correlation_id: input.correlationId ?? null,
      request_summary: input.requestSummary ?? {},
      status: 'running',
    })
    .select('id')
    .single();

  if (!error && data?.id) return { duplicate: false, ledgerId: data.id };
  if (error?.code !== '23505') throw error;

  const { data: existing, error: existingError } = await admin
    .from('listmonk_operation_ledger')
    .select('id, status, result')
    .eq('tenant_id', input.tenantId)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw error;

  return {
    duplicate: true,
    ledgerId: existing.id,
    existingResult: (existing.result as Record<string, unknown>) || {},
  };
}

async function completeOperation(
  admin: SupabaseClient,
  ledgerId: string,
  result: Record<string, unknown>,
) {
  const { error } = await admin
    .from('listmonk_operation_ledger')
    .update({ status: 'completed', result, error: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', ledgerId);
  if (error) throw error;
}

async function failOperation(admin: SupabaseClient, ledgerId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Listmonk operation failed';
  await admin
    .from('listmonk_operation_ledger')
    .update({
      status: 'failed',
      error: message.slice(0, 1000),
      retry_count: 1,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ledgerId);
}

export async function ensureListmonkList(
  admin: SupabaseClient,
  input: { tenantId: string; segmentKey: string; name: string; correlationId?: string },
) {
  await assertEnabled(admin, input.tenantId);

  const { data: existing, error: existingError } = await admin
    .from('listmonk_list_mappings')
    .select('listmonk_list_id, listmonk_list_uuid, list_name')
    .eq('tenant_id', input.tenantId)
    .eq('alphaclone_segment_key', input.segmentKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { duplicate: true, ...existing };

  const claim = await claimOperation(admin, {
    tenantId: input.tenantId,
    idempotencyKey: `listmonk:list:${input.segmentKey}`,
    operation: 'list.create',
    entityType: 'segment',
    entityId: input.segmentKey,
    correlationId: input.correlationId,
    requestSummary: { name: input.name },
  });
  if (claim.duplicate && claim.existingResult?.listmonkListId) return claim.existingResult;

  try {
    const remote = await createListmonkList({ name: input.name, type: 'private', optin: 'single', tags: ['alphaclone', input.tenantId] });
    const row = {
      tenant_id: input.tenantId,
      alphaclone_segment_key: input.segmentKey,
      listmonk_list_id: remote.data.id,
      listmonk_list_uuid: remote.data.uuid ?? null,
      list_name: remote.data.name,
    };
    const { error } = await admin.from('listmonk_list_mappings').upsert(row, { onConflict: 'tenant_id,alphaclone_segment_key' });
    if (error) throw error;
    const result = { listmonkListId: remote.data.id, listmonkListUuid: remote.data.uuid ?? null, listName: remote.data.name };
    await completeOperation(admin, claim.ledgerId, result);
    return result;
  } catch (error) {
    await failOperation(admin, claim.ledgerId, error);
    throw error;
  }
}

export async function syncListmonkSubscriber(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    contactId?: string | null;
    email: string;
    name: string;
    listIds: number[];
    suppressed?: boolean;
    attributes?: Record<string, unknown>;
    correlationId?: string;
  },
) {
  await assertEnabled(admin, input.tenantId);
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('A valid subscriber email is required');

  const { data: existing, error: existingError } = await admin
    .from('listmonk_subscriber_mappings')
    .select('listmonk_subscriber_id, status')
    .eq('tenant_id', input.tenantId)
    .eq('email', email)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.listmonk_subscriber_id) {
    const shouldBlock = Boolean(input.suppressed);
    const currentlyBlocked = existing.status === 'blocklisted';
    if (shouldBlock !== currentlyBlocked) {
      await setListmonkSubscriberBlocklist(Number(existing.listmonk_subscriber_id), shouldBlock);
      await admin
        .from('listmonk_subscriber_mappings')
        .update({ status: shouldBlock ? 'blocklisted' : 'enabled', last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('tenant_id', input.tenantId)
        .eq('email', email);
    }
    return { duplicate: true, listmonkSubscriberId: Number(existing.listmonk_subscriber_id), status: shouldBlock ? 'blocklisted' : 'enabled' };
  }

  const claim = await claimOperation(admin, {
    tenantId: input.tenantId,
    idempotencyKey: `listmonk:subscriber:${email}`,
    operation: 'subscriber.sync',
    entityType: 'contact',
    entityId: input.contactId ?? email,
    correlationId: input.correlationId,
    requestSummary: { email, listIds: input.listIds, suppressed: Boolean(input.suppressed) },
  });
  if (claim.duplicate && claim.existingResult?.listmonkSubscriberId) return claim.existingResult;

  try {
    const remote = await createListmonkSubscriber({
      email,
      name: input.name || email,
      lists: [...new Set(input.listIds)],
      attribs: { ...(input.attributes ?? {}), alphaclone_tenant_id: input.tenantId, alphaclone_contact_id: input.contactId ?? null },
      blocklisted: Boolean(input.suppressed),
    });
    const status = input.suppressed ? 'blocklisted' : remote.data.status;
    const { error } = await admin.from('listmonk_subscriber_mappings').upsert({
      tenant_id: input.tenantId,
      contact_id: input.contactId ?? null,
      email,
      listmonk_subscriber_id: remote.data.id,
      listmonk_subscriber_uuid: remote.data.uuid ?? null,
      status,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,email' });
    if (error) throw error;
    const result = { listmonkSubscriberId: remote.data.id, listmonkSubscriberUuid: remote.data.uuid ?? null, status };
    await completeOperation(admin, claim.ledgerId, result);
    return result;
  } catch (error) {
    await failOperation(admin, claim.ledgerId, error);
    throw error;
  }
}

export async function createMappedListmonkCampaign(
  admin: SupabaseClient,
  input: {
    tenantId: string;
    campaignId: string;
    name: string;
    subject: string;
    bodyHtml: string;
    listIds: number[];
    fromEmail: string;
    correlationId?: string;
  },
) {
  await assertEnabled(admin, input.tenantId);
  const { data: existing, error: existingError } = await admin
    .from('listmonk_campaign_mappings')
    .select('listmonk_campaign_id, status')
    .eq('tenant_id', input.tenantId)
    .eq('campaign_id', input.campaignId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { duplicate: true, listmonkCampaignId: Number(existing.listmonk_campaign_id), status: existing.status };

  const claim = await claimOperation(admin, {
    tenantId: input.tenantId,
    idempotencyKey: `listmonk:campaign:create:${input.campaignId}`,
    operation: 'campaign.create',
    entityType: 'email_campaign',
    entityId: input.campaignId,
    correlationId: input.correlationId,
    requestSummary: { name: input.name, subject: input.subject, listIds: input.listIds },
  });
  if (claim.duplicate && claim.existingResult?.listmonkCampaignId) return claim.existingResult;

  try {
    const remote = await createListmonkCampaign({
      name: input.name,
      subject: input.subject,
      body: input.bodyHtml,
      listIds: [...new Set(input.listIds)],
      fromEmail: input.fromEmail,
    });
    const { error } = await admin.from('listmonk_campaign_mappings').insert({
      tenant_id: input.tenantId,
      campaign_id: input.campaignId,
      listmonk_campaign_id: remote.data.id,
      status: remote.data.status,
      last_synced_at: new Date().toISOString(),
    });
    if (error) throw error;
    const result = { listmonkCampaignId: remote.data.id, status: remote.data.status };
    await completeOperation(admin, claim.ledgerId, result);
    return result;
  } catch (error) {
    await failOperation(admin, claim.ledgerId, error);
    throw error;
  }
}
