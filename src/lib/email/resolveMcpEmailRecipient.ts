import type { SupabaseClient } from '@supabase/supabase-js';

function pickEmail(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const direct = String(row.email || row.contact_email || '').trim();
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
 * Lookup order: to → lead → contact → business_client → deal → scraper_lead.
 * Works across discovered / qualified / proposal / negotiation stages.
 */
export async function resolveMcpEmailRecipient(
  supabase: SupabaseClient,
  tenantId: string,
  args: {
    to?: unknown;
    lead_id?: unknown;
    client_id?: unknown;
    contact_id?: unknown;
    deal_id?: unknown;
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
      .eq('id', clientId)
      .maybeSingle();
    const email = pickEmail(data as Record<string, unknown> | null);
    if (email) return { email, source: 'client', recordId: clientId };
  }

  const dealId = String(args.deal_id || '').trim();
  if (dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id, email, contact_email, contact_id, client_id, lead_id')
      .eq('tenant_id', tenantId)
      .eq('id', dealId)
      .maybeSingle();
    const dealEmail = pickEmail(deal as Record<string, unknown> | null);
    if (dealEmail) return { email: dealEmail, source: 'deal', recordId: dealId };

    if (deal?.contact_id || deal?.client_id || deal?.lead_id) {
      return resolveMcpEmailRecipient(supabase, tenantId, {
        contact_id: deal.contact_id,
        client_id: deal.client_id,
        lead_id: deal.lead_id,
      });
    }
  }

  throw new Error(
    'Recipient required: pass `to`, or a lead_id / contact_id / client_id / deal_id with a stored email. Add an email on the CRM record if missing.'
  );
}

/** Best-effort email extraction for batch outreach entities. */
export function pickEntityEmail(entity: Record<string, unknown> | null | undefined): string | null {
  return pickEmail(entity);
}
