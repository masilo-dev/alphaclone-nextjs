import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves enrollment contact_id to canonical `contacts.id`.
 * Accepts contacts.id or business_clients.id (via crm_contact_id).
 */
export async function resolveEnrollmentContactId(
  supabase: SupabaseClient,
  tenantId: string,
  rawContactId: string
): Promise<string | null> {
  const contactId = rawContactId.trim();
  if (!contactId) return null;

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', contactId)
    .is('deleted_at', null)
    .maybeSingle();
  if (contact?.id) return String(contact.id);

  const { data: client } = await supabase
    .from('business_clients')
    .select('crm_contact_id')
    .eq('tenant_id', tenantId)
    .eq('id', contactId)
    .maybeSingle();
  if (client?.crm_contact_id) return String(client.crm_contact_id);

  const { data: clientByCrm } = await supabase
    .from('business_clients')
    .select('crm_contact_id')
    .eq('tenant_id', tenantId)
    .eq('crm_contact_id', contactId)
    .maybeSingle();
  if (clientByCrm?.crm_contact_id) return String(clientByCrm.crm_contact_id);

  return null;
}
