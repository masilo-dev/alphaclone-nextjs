import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logCrmActivityAdmin } from '@/lib/crm/crmActivityServer';

type DealRow = {
  id: string;
  tenant_id: string;
  name: string;
  contact_id?: string | null;
  owner_id?: string | null;
  value?: number | null;
  currency?: string | null;
  stage?: string | null;
  probability?: number | null;
  expected_close_date?: string | null;
  actual_close_date?: string | null;
  description?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

function extractDomain(email?: string | null): string | null {
  if (!email) return null;
  const match = String(email).match(/@(.+)$/);
  return match ? match[1].toLowerCase() : null;
}

async function findOpportunityForDeal(admin: SupabaseClient, tenantId: string, dealId: string, dealMeta?: Record<string, unknown> | null) {
  const linkedId = typeof dealMeta?.unified_opportunity_id === 'string' ? dealMeta.unified_opportunity_id : null;
  if (linkedId) {
    const { data } = await admin
      .from('opportunities')
      .select('id, company_id')
      .eq('id', linkedId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (data?.id) return data;
  }

  const { data: rows } = await admin
    .from('opportunities')
    .select('id, company_id, custom_fields')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(200);

  return (rows || []).find((row) => {
    const cf = (row.custom_fields || {}) as Record<string, unknown>;
    return String(cf.original_deal_id || '') === dealId;
  }) || null;
}

async function resolveCompanyForDeal(admin: SupabaseClient, tenantId: string, deal: DealRow) {
  const meta = (deal.metadata || {}) as Record<string, unknown>;
  const linkedCompanyId = typeof meta.unified_company_id === 'string' ? meta.unified_company_id : null;
  if (linkedCompanyId) {
    const { data } = await admin
      .from('companies')
      .select('id')
      .eq('id', linkedCompanyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (deal.contact_id) {
    const { data: contact } = await admin
      .from('contacts')
      .select('company_id, email, first_name, last_name')
      .eq('id', deal.contact_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (contact?.company_id) return contact.company_id;

    const { data: client } = await admin
      .from('business_clients')
      .select('id, name, email, crm_contact_id')
      .eq('id', deal.contact_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (client) {
      if (client.crm_contact_id) {
        const { data: linked } = await admin
          .from('contacts')
          .select('company_id')
          .eq('id', client.crm_contact_id)
          .maybeSingle();
        if (linked?.company_id) return linked.company_id;
      }
      const domain = extractDomain(client.email);
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
      const companyName = client.name || deal.name;
      const { data: created } = await admin
        .from('companies')
        .insert({
          tenant_id: tenantId,
          name: companyName,
          domain: domain,
          lifecycle_stage: 'prospect',
          tags: ['synced-from-deal'],
          custom_fields: { original_client_id: client.id, original_deal_id: deal.id },
        })
        .select('id')
        .single();
      return created?.id || null;
    }
  }

  const companyName = deal.name?.split(' - ')[0]?.trim() || deal.name;
  const { data: existing } = await admin
    .from('companies')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', companyName)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await admin
    .from('companies')
    .insert({
      tenant_id: tenantId,
      name: companyName,
      lifecycle_stage: 'prospect',
      tags: ['synced-from-deal'],
      custom_fields: { original_deal_id: deal.id },
    })
    .select('id')
    .single();
  return created?.id || null;
}

export async function syncDealToUnified(admin: SupabaseClient, dealId: string, tenantId: string) {
  const { data: deal, error } = await admin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !deal) return { synced: false, reason: 'deal_not_found' };

  const companyId = await resolveCompanyForDeal(admin, tenantId, deal as DealRow);
  if (!companyId) return { synced: false, reason: 'company_unresolved' };

  const existing = await findOpportunityForDeal(admin, tenantId, dealId, deal.metadata as Record<string, unknown> | null);
  const oppPayload = {
    tenant_id: tenantId,
    company_id: companyId,
    name: deal.name,
    description: deal.description,
    amount: deal.value ?? 0,
    currency: deal.currency || 'USD',
    stage: deal.stage || 'lead',
    probability: deal.probability ?? 0,
    expected_close_date: deal.expected_close_date,
    actual_close_date: deal.actual_close_date,
    owner_id: deal.owner_id,
    lead_source: deal.source || deal.lead_source,
    custom_fields: { original_deal_id: dealId },
    updated_at: new Date().toISOString(),
  };

  let opportunityId = existing?.id;
  if (existing?.id) {
    await admin.from('opportunities').update(oppPayload).eq('id', existing.id);
  } else {
    const { data: created } = await admin
      .from('opportunities')
      .insert({ ...oppPayload, created_at: new Date().toISOString() })
      .select('id')
      .single();
    opportunityId = created?.id;
  }

  const nextMeta = {
    ...((deal.metadata || {}) as Record<string, unknown>),
    unified_company_id: companyId,
    unified_opportunity_id: opportunityId,
  };
  await admin.from('deals').update({ metadata: nextMeta }).eq('id', dealId);

  return { synced: true, companyId, opportunityId };
}

export async function syncLeadToUnified(admin: SupabaseClient, leadId: string, tenantId: string) {
  const { data: lead, error } = await admin.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (error || !lead) return { synced: false, reason: 'lead_not_found' };

  const domain = extractDomain(lead.email);
  let companyId: string | null = null;

  if (domain) {
    const { data: byDomain } = await admin
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('domain', domain)
      .limit(1)
      .maybeSingle();
    companyId = byDomain?.id || null;
  }

  if (!companyId && lead.business_name) {
    const { data: byName } = await admin
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', lead.business_name)
      .limit(1)
      .maybeSingle();
    companyId = byName?.id || null;
  }

  if (!companyId) {
    const { data: created } = await admin
      .from('companies')
      .insert({
        tenant_id: tenantId,
        name: lead.business_name || lead.email || 'Imported Lead',
        domain,
        industry: lead.industry,
        lifecycle_stage: 'lead',
        tags: ['synced-from-lead'],
        custom_fields: { original_lead_id: leadId },
      })
      .select('id')
      .single();
    companyId = created?.id || null;
  }

  if (!companyId) return { synced: false, reason: 'company_unresolved' };

  if (lead.email) {
    const { data: existingContact } = await admin
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', lead.email)
      .limit(1)
      .maybeSingle();

    if (!existingContact?.id) {
      const parts = String(lead.business_name || lead.email).split(/\s+/);
      await admin.from('contacts').insert({
        tenant_id: tenantId,
        company_id: companyId,
        first_name: parts[0] || 'Lead',
        last_name: parts.slice(1).join(' ') || 'Contact',
        email: lead.email,
        phone: lead.phone,
        lifecycle_stage: 'lead',
        tags: ['synced-from-lead'],
        custom_fields: { original_lead_id: leadId },
      });
    }
  }

  return { synced: true, companyId };
}

export async function syncClientToUnified(admin: SupabaseClient, clientId: string, tenantId: string) {
  const { data: client, error } = await admin
    .from('business_clients')
    .select('*')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !client) return { synced: false, reason: 'client_not_found' };

  const domain = extractDomain(client.email);
  let companyId: string | null = null;

  if (domain) {
    const { data: byDomain } = await admin
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('domain', domain)
      .limit(1)
      .maybeSingle();
    companyId = byDomain?.id || null;
  }

  if (!companyId) {
    const { data: created } = await admin
      .from('companies')
      .insert({
        tenant_id: tenantId,
        name: client.name,
        domain,
        lifecycle_stage: client.sales_stage === 'customer' ? 'customer' : 'prospect',
        tags: ['synced-from-client'],
        custom_fields: { original_client_id: clientId },
      })
      .select('id')
      .single();
    companyId = created?.id || null;
  }

  if (!companyId) return { synced: false, reason: 'company_unresolved' };

  let contactId = client.crm_contact_id;
  if (!contactId && client.email) {
    const parts = String(client.name || client.company).split(/\s+/);
    const { data: contact } = await admin
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        company_id: companyId,
        first_name: parts[0] || 'Client',
        last_name: parts.slice(1).join(' ') || 'Contact',
        email: client.email,
        phone: client.phone,
        lifecycle_stage: client.sales_stage === 'customer' ? 'customer' : 'lead',
        tags: ['synced-from-client'],
        custom_fields: { original_client_id: clientId },
      })
      .select('id')
      .single();
    contactId = contact?.id;
    if (contactId) {
      await admin.from('business_clients').update({ crm_contact_id: contactId }).eq('id', clientId);
    }
  }

  return { synced: true, companyId, contactId };
}

export async function syncCrmEntity(
  admin: SupabaseClient,
  entity: 'deal' | 'lead' | 'client',
  entityId: string,
  tenantId: string
) {
  if (entity === 'deal') return syncDealToUnified(admin, entityId, tenantId);
  if (entity === 'lead') return syncLeadToUnified(admin, entityId, tenantId);
  return syncClientToUnified(admin, entityId, tenantId);
}

export async function reconcileTenantCrm(admin: SupabaseClient, tenantId: string) {
  const summary = {
    dealsSynced: 0,
    leadsSynced: 0,
    clientsSynced: 0,
    failures: 0,
  };

  const { data: deals } = await admin.from('deals').select('id').eq('tenant_id', tenantId).limit(500);
  for (const row of deals || []) {
    const result = await syncDealToUnified(admin, row.id, tenantId);
    if (result.synced) summary.dealsSynced += 1;
    else summary.failures += 1;
  }

  const { data: leads } = await admin.from('leads').select('id').eq('tenant_id', tenantId).limit(500);
  for (const row of leads || []) {
    const result = await syncLeadToUnified(admin, row.id, tenantId);
    if (result.synced) summary.leadsSynced += 1;
    else summary.failures += 1;
  }

  const { data: clients } = await admin
    .from('business_clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(500);
  for (const row of clients || []) {
    const result = await syncClientToUnified(admin, row.id, tenantId);
    if (result.synced) summary.clientsSynced += 1;
    else summary.failures += 1;
  }

  return summary;
}

export async function logDealStageActivity(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    dealId: string;
    fromStage: string;
    toStage: string;
    userId?: string;
  }
) {
  const meta = (await admin.from('deals').select('metadata').eq('id', params.dealId).maybeSingle()).data
    ?.metadata as Record<string, unknown> | undefined;

  await logCrmActivityAdmin(admin, {
    tenantId: params.tenantId,
    dealId: params.dealId,
    type: 'stage_change',
    subject: `Stage changed: ${params.fromStage} → ${params.toStage}`,
    description: `Deal moved from ${params.fromStage} to ${params.toStage}`,
    companyId: typeof meta?.unified_company_id === 'string' ? meta.unified_company_id : undefined,
    opportunityId: typeof meta?.unified_opportunity_id === 'string' ? meta.unified_opportunity_id : undefined,
    createdBy: params.userId,
    isAutomated: true,
    source: 'deal_pipeline',
    metadata: { from_stage: params.fromStage, to_stage: params.toStage },
  });
}
