import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Deep-link contract:
 * - `contactId` in URLs is always a resolvable CRM person id.
 * - Prefer `contacts.id` in search/links; ClientsPage resolves to `business_clients` when linked.
 */
export type ResolvedContactDeepLink =
  | { kind: 'business_client'; clientId: string }
  | { kind: 'contacts_only'; contactId: string }
  | { kind: 'lead'; leadId: string }
  | { kind: 'not_found' };

export async function resolveContactDeepLink(
  supabase: SupabaseClient,
  tenantId: string,
  contactId: string,
  loadedClientIds?: Array<{ id: string; crmContactId?: string | null }>
): Promise<ResolvedContactDeepLink> {
  const trimmed = contactId.trim();
  if (!trimmed) return { kind: 'not_found' };

  const inMemoryClient = loadedClientIds?.find(
    (client) => client.id === trimmed || client.crmContactId === trimmed
  );
  if (inMemoryClient) {
    return { kind: 'business_client', clientId: inMemoryClient.id };
  }

  const { data: clientById } = await supabase
    .from('business_clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', trimmed)
    .maybeSingle();
  if (clientById?.id) {
    return { kind: 'business_client', clientId: String(clientById.id) };
  }

  const { data: clientByCrm } = await supabase
    .from('business_clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('crm_contact_id', trimmed)
    .maybeSingle();
  if (clientByCrm?.id) {
    return { kind: 'business_client', clientId: String(clientByCrm.id) };
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', trimmed)
    .is('deleted_at', null)
    .maybeSingle();
  if (contact?.id) {
    return { kind: 'contacts_only', contactId: String(contact.id) };
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('id, client_id, contact_id')
    .eq('tenant_id', tenantId)
    .eq('id', trimmed)
    .maybeSingle();
  if (lead?.client_id) {
    return { kind: 'business_client', clientId: String(lead.client_id) };
  }
  if (lead?.contact_id) {
    return { kind: 'contacts_only', contactId: String(lead.contact_id) };
  }
  if (lead?.id) {
    return { kind: 'lead', leadId: String(lead.id) };
  }

  return { kind: 'not_found' };
}
