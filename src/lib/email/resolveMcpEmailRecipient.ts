import type { SupabaseClient } from '@supabase/supabase-js';

function pickEmail(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const direct = String(row.email || '').trim();
  if (direct.includes('@')) return direct;
  const emails = row.emails;
  if (Array.isArray(emails) && emails.length > 0) {
    const first = String(emails[0] || '').trim();
    if (first.includes('@')) return first;
  }
  return null;
}

/**
 * Resolve a transactional email recipient from explicit `to` or CRM record IDs.
 * Lookup order: lead → contact → business_client.
 */
export async function resolveMcpEmailRecipient(
  supabase: SupabaseClient,
  tenantId: string,
  args: {
    to?: unknown;
    lead_id?: unknown;
    client_id?: unknown;
    contact_id?: unknown;
  }
): Promise<{ email: string; source: string; recordId: string }> {
  const directTo = String(args.to || '').trim();
  if (directTo.includes('@')) {
    return { email: directTo, source: 'to', recordId: directTo };
  }

  const leadId = String(args.lead_id || '').trim();
  if (leadId) {
    const { data } = await supabase
      .from('leads')
      .select('id, email, emails')
      .eq('tenant_id', tenantId)
      .eq('id', leadId)
      .maybeSingle();
    const email = pickEmail(data as Record<string, unknown> | null);
    if (email) return { email, source: 'lead', recordId: leadId };
  }

  const contactId = String(args.contact_id || '').trim();
  if (contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, email, emails')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('id', contactId)
      .maybeSingle();
    const email = pickEmail(data as Record<string, unknown> | null);
    if (email) return { email, source: 'contact', recordId: contactId };
  }

  const clientId = String(args.client_id || '').trim();
  if (clientId) {
    const { data } = await supabase
      .from('business_clients')
      .select('id, email, emails')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('id', clientId)
      .maybeSingle();
    const email = pickEmail(data as Record<string, unknown> | null);
    if (email) return { email, source: 'client', recordId: clientId };
  }

  throw new Error(
    'Recipient required: pass `to`, or a lead_id / contact_id / client_id with a stored email.'
  );
}
