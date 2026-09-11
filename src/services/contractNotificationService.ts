import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';
import { AppUrls } from '@/lib/urls';
import {
  closeDealFromContractSign,
  resolveOpenDealForParty,
} from '@/lib/contracts/contractCoherenceServer';

type DraftReminderTier = '24h' | '72h';

function contractLink(contractId: string): string {
  return `/dashboard/business/contracts/manage?contract=${encodeURIComponent(contractId)}`;
}

export async function notifyContractCreated(
  tenantId: string,
  contractId: string,
  title: string,
  fallbackUserId?: string
): Promise<void> {
  await notifyTenantOwners({
    tenantId,
    type: 'contract',
    title: 'Contract created — ready to send',
    message: `"${title}" is in draft. Review and send when ready.`,
    link: contractLink(contractId),
    fallbackUserId,
  });
}

export async function notifyContractSent(
  tenantId: string,
  contractId: string,
  title: string,
  sentTo: string,
  fallbackUserId?: string
): Promise<void> {
  await notifyTenantOwners({
    tenantId,
    type: 'contract',
    title: `Contract sent: ${title}`,
    message: `Sent to ${sentTo}. Waiting for signature.`,
    link: contractLink(contractId),
    fallbackUserId,
  });
}

export async function notifyContractSigned(
  tenantId: string,
  contractId: string,
  title: string,
  clientName: string,
  fallbackUserId?: string
): Promise<void> {
  await notifyTenantOwners({
    tenantId,
    type: 'contract',
    title: `${clientName} signed ${title}`,
    message: `Contract "${title}" was signed by ${clientName}.`,
    link: contractLink(contractId),
    fallbackUserId,
  });
}

async function wasReminderSent(
  tenantId: string,
  contractId: string,
  tier: DraftReminderTier
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const marker = `contract_draft_${tier}`;
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('type', 'contract')
    .ilike('message', `%${marker}:${contractId}%`);

  return (count || 0) > 0;
}

export async function processContractDraftReminders(): Promise<{
  notified: number;
  errors: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  let notified = 0;
  let errors = 0;

  const { data: drafts, error } = await admin
    .from('contracts')
    .select('id, tenant_id, title, created_at, created_by')
    .eq('status', 'draft')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[contractDraftReminders]', error.message);
    return { notified: 0, errors: 1 };
  }

  for (const contract of drafts || []) {
    try {
      const ageMs = now - new Date(contract.created_at).getTime();
      const hours = ageMs / (1000 * 60 * 60);
      const tier: DraftReminderTier | null =
        hours >= 72 ? '72h' : hours >= 24 ? '24h' : null;
      if (!tier) continue;

      if (await wasReminderSent(contract.tenant_id, contract.id, tier)) continue;

      const isUrgent = tier === '72h';
      await notifyTenantOwners({
        tenantId: contract.tenant_id,
        type: 'contract',
        title: isUrgent ? 'Contract still unsent (urgent)' : 'Contract sitting unsent',
        message: `"${contract.title}" has been in draft for ${tier === '72h' ? '72+' : '24+'} hours. contract_draft_${tier}:${contract.id}. Ready to send?`,
        link: contractLink(contract.id),
        fallbackUserId: contract.created_by || undefined,
      });
      notified += 1;
    } catch (err) {
      console.error('[contractDraftReminders] contract', contract.id, err);
      errors += 1;
    }
  }

  return { notified, errors };
}

export async function onContractSignedSideEffects(options: {
  tenantId: string;
  contractId: string;
  title: string;
  clientId?: string | null;
  clientName?: string;
  dealId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const clientName = options.clientName || 'Client';

  await notifyContractSigned(
    options.tenantId,
    options.contractId,
    options.title,
    clientName,
    options.createdBy || undefined
  );

  if (options.clientId) {
    await admin.from('activity_logs').insert({
      tenant_id: options.tenantId,
      user_id: options.createdBy || null,
      action: 'contract_signed',
      entity_type: 'client',
      entity_id: options.clientId,
      metadata: { contract_id: options.contractId, title: options.title },
    });
  }

  if (options.dealId) {
    await closeDealFromContractSign(admin, options.tenantId, {
      dealId: options.dealId,
      partyId: options.clientId,
    });
  } else if (options.clientId) {
    const openDealId = await resolveOpenDealForParty(admin, options.tenantId, options.clientId);
    if (openDealId) {
      await closeDealFromContractSign(admin, options.tenantId, { dealId: openDealId });
    }
  }
}

export { AppUrls };
