import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { syncDealToUnified } from '@/lib/crm/crmBridgeServer';

type ContractRow = {
  deal_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function resolveContractDealId(contract: ContractRow): string | null {
  if (contract.deal_id) return contract.deal_id;
  const meta = (contract.metadata || {}) as Record<string, unknown>;
  return typeof meta.deal_id === 'string' ? meta.deal_id : null;
}

export async function resolvePartyEmail(
  admin: SupabaseClient,
  tenantId: string,
  partyId?: string | null
): Promise<string | null> {
  if (!partyId) return null;

  const { data: contact } = await admin
    .from('contacts')
    .select('email')
    .eq('id', partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (contact?.email) return String(contact.email).trim().toLowerCase();

  const { data: client } = await admin
    .from('business_clients')
    .select('email')
    .eq('id', partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return client?.email ? String(client.email).trim().toLowerCase() : null;
}

export async function resolveContactIdForParty(
  admin: SupabaseClient,
  tenantId: string,
  partyId?: string | null
): Promise<string | null> {
  if (!partyId) return null;

  const { data: contact } = await admin
    .from('contacts')
    .select('id')
    .eq('id', partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (contact?.id) return contact.id;

  const { data: client } = await admin
    .from('business_clients')
    .select('crm_contact_id')
    .eq('id', partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return client?.crm_contact_id || null;
}

export async function resolveBusinessClientIdForParty(
  admin: SupabaseClient,
  tenantId: string,
  partyId?: string | null
): Promise<string | null> {
  if (!partyId) return null;

  const { data: client } = await admin
    .from('business_clients')
    .select('id')
    .eq('id', partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (client?.id) return client.id;

  const contactId = await resolveContactIdForParty(admin, tenantId, partyId);
  if (!contactId) return null;

  const { data: byContact } = await admin
    .from('business_clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('crm_contact_id', contactId)
    .limit(1)
    .maybeSingle();
  return byContact?.id || null;
}

export async function resolveOpenDealForParty(
  admin: SupabaseClient,
  tenantId: string,
  partyId?: string | null
): Promise<string | null> {
  const contactId = await resolveContactIdForParty(admin, tenantId, partyId);
  if (!contactId) return null;

  const { data: deal } = await admin
    .from('deals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return deal?.id || null;
}

export async function closeDealFromContractSign(
  admin: SupabaseClient,
  tenantId: string,
  options: { dealId?: string | null; partyId?: string | null }
): Promise<string | null> {
  let dealId = options.dealId || null;
  if (!dealId && options.partyId) {
    dealId = await resolveOpenDealForParty(admin, tenantId, options.partyId);
  }
  if (!dealId) return null;

  await admin
    .from('deals')
    .update({ stage: 'closed_won', updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .eq('tenant_id', tenantId);

  const bridge = await syncDealToUnified(admin, dealId, tenantId);

  if (bridge.opportunityId) {
    await admin
      .from('opportunities')
      .update({
        stage: 'closed_won',
        actual_close_date: new Date().toISOString(),
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', bridge.opportunityId);
  }

  if (bridge.companyId) {
    await admin
      .from('companies')
      .update({
        lifecycle_stage: 'customer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bridge.companyId);
  }

  return dealId;
}

export async function resolveCompanyIdForParty(
  admin: SupabaseClient,
  tenantId: string,
  partyId?: string | null
): Promise<string | null> {
  if (!partyId) return null;

  const { data: contact } = await admin
    .from('contacts')
    .select('company_id, email')
    .eq('id', partyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (contact?.company_id) return contact.company_id;

  const contactId = await resolveContactIdForParty(admin, tenantId, partyId);
  if (contactId && contactId !== partyId) {
    const { data: linked } = await admin
      .from('contacts')
      .select('company_id')
      .eq('id', contactId)
      .maybeSingle();
    if (linked?.company_id) return linked.company_id;
  }

  const email = contact?.email || (await resolvePartyEmail(admin, tenantId, partyId));
  if (email) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain) {
      const { data: byDomain } = await admin
        .from('companies')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('domain', domain)
        .limit(1)
        .maybeSingle();
      if (byDomain?.id) return byDomain.id;
    }
  }

  return null;
}
