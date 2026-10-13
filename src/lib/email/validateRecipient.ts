import { SupabaseClient } from '@supabase/supabase-js';

async function emailExistsInColumn(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  email: string,
  extraFilters?: (q: any) => any
): Promise<boolean> {
  let query = supabase
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('email', email)
    .limit(1);
  if (extraFilters) query = extraFilters(query);
  const { data } = await query.maybeSingle();
  return Boolean(data);
}

/**
 * Validates if a recipient email belongs to a CRM record in the tenant.
 * Covers leads, contacts, clients (active + inactive), quotes, and scraper leads.
 * Used to gate bulk outreach; compose from CRM / discovered→negotiation stages must pass.
 */
export async function validateRecipient(
  supabase: SupabaseClient,
  tenantId: string,
  email: string
): Promise<{ allowed: boolean; reason?: string; source?: string }> {
  if (!email) {
    return { allowed: false, reason: 'Recipient email is missing.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    return { allowed: false, reason: 'Recipient email is invalid.' };
  }

  const contactFilter = (q: any) => q.is('deleted_at', null);

  const checks = await Promise.all([
    emailExistsInColumn(supabase, 'leads', tenantId, normalizedEmail).then((ok) =>
      ok ? 'lead' : null
    ),
    emailExistsInColumn(supabase, 'contacts', tenantId, normalizedEmail, contactFilter).then((ok) =>
      ok ? 'contact' : null
    ),
    emailExistsInColumn(supabase, 'business_clients', tenantId, normalizedEmail).then((ok) =>
      ok ? 'client' : null
    ),
    supabase.from('quotes').select('id').eq('tenant_id', tenantId)
      .ilike('client_email', normalizedEmail).limit(1).maybeSingle()
      .then(({ data }) => (data ? 'quote' : null)),
    supabase
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .filter('metadata->>client_email', 'ilike', normalizedEmail)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => (data ? 'quote' : null)),
    supabase
      .from('scraper_leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return null;
        return data ? 'scraper_lead' : null;
      }),
  ]);

  const source = checks.find(Boolean);
  if (source) return { allowed: true, source };

  return {
    allowed: false,
    reason:
      'Recipient email not found in your leads, contacts, clients, or quotes. Add them to CRM first, or send from a module compose that already selected this contact.',
  };
}
