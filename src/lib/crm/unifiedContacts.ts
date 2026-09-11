import type { SupabaseClient } from '@supabase/supabase-js';
import { buildIlikeOrFilter } from '@/lib/db/postgrestFilters';

export type UnifiedContact = {
  id: string;
  tenant_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  lifecycle_stage: string | null;
  company_id: string | null;
  business_client_id: string | null;
  source: 'contacts' | 'business_clients';
  created_at: string;
};

function splitDisplayName(name: string): { first_name: string; last_name: string } {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0] || 'Contact', last_name: parts[0] || 'Unknown' };
  }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

/**
 * Returns CRM contacts merged with business_clients that lack a contacts row.
 * After P1 migration + trigger, contacts is the canonical store; this fills gaps on read.
 */
export async function getUnifiedContacts(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { limit?: number; search?: string; status?: string }
): Promise<UnifiedContact[]> {
  const limit = options?.limit ?? 50;

  let contactQuery = supabase
    .from('contacts')
    .select('id, tenant_id, first_name, last_name, full_name, email, phone, status, company_id, custom_fields, created_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .neq('status', 'bounced')
    .limit(limit);

  if (options?.status) {
    contactQuery = contactQuery.eq('status', options.status);
  }
  if (options?.search) {
    const contactOr = buildIlikeOrFilter(
      ['full_name', 'email', 'phone'],
      options.search
    );
    if (contactOr) contactQuery = contactQuery.or(contactOr);
  }

  const { data: contactRows, error: contactErr } = await contactQuery;
  if (contactErr) throw contactErr;

  const contactIds = (contactRows || []).map((row) => row.id);
  const clientByContactId = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: linkedClients } = await supabase
      .from('business_clients')
      .select('id, crm_contact_id')
      .eq('tenant_id', tenantId)
      .in('crm_contact_id', contactIds);
    for (const client of linkedClients || []) {
      if (client.crm_contact_id) {
        clientByContactId.set(String(client.crm_contact_id), String(client.id));
      }
    }
  }

  const unified: UnifiedContact[] = (contactRows || []).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    full_name: row.full_name || `${row.first_name} ${row.last_name}`.trim(),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    status: row.status || 'active',
    lifecycle_stage: (row.custom_fields as Record<string, unknown> | null)?.sales_stage as string | null ?? row.status,
    company_id: row.company_id,
    business_client_id: clientByContactId.get(row.id) ?? null,
    source: 'contacts' as const,
    created_at: row.created_at,
  }));

  const seenEmails = new Set(
    unified.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[]
  );

  let clientQuery = supabase
    .from('business_clients')
    .select('id, tenant_id, name, email, phone, sales_stage, crm_contact_id, created_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(limit);

  if (options?.search) {
    const clientOr = buildIlikeOrFilter(['name', 'email', 'phone'], options.search);
    if (clientOr) clientQuery = clientQuery.or(clientOr);
  }

  const { data: clientRows, error: clientErr } = await clientQuery;
  if (clientErr) throw clientErr;

  for (const client of clientRows || []) {
    const emailKey = client.email?.toLowerCase();
    if (client.crm_contact_id || (emailKey && seenEmails.has(emailKey))) continue;
    if (!client.email && !client.phone) continue;

    const { first_name, last_name } = splitDisplayName(client.name || 'Contact');
    unified.push({
      id: client.crm_contact_id || client.id,
      tenant_id: client.tenant_id,
      full_name: client.name || `${first_name} ${last_name}`.trim(),
      first_name,
      last_name,
      email: client.email,
      phone: client.phone,
      status: 'active',
      lifecycle_stage: client.sales_stage === 'customer' ? 'customer' : 'lead',
      company_id: null,
      business_client_id: client.id,
      source: 'business_clients',
      created_at: client.created_at,
    });
    if (emailKey) seenEmails.add(emailKey);
  }

  return unified.slice(0, limit);
}
