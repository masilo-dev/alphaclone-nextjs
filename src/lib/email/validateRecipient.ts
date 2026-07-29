import { SupabaseClient } from '@supabase/supabase-js';

<<<<<<< HEAD
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

async function emailExistsInEmailsArray(
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
    .contains('emails', [email])
    .limit(1);
  if (extraFilters) query = extraFilters(query);
  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * Validates if a recipient email belongs to a CRM record in the tenant.
 * Covers leads, contacts, clients (active + inactive), quotes, deals, and scraper leads.
 * Used to gate bulk outreach; compose from CRM / discovered→negotiation stages must pass.
=======
/**
 * Validates if a recipient email belongs to a lead or client in the given tenant.
 * This is a security measure to prevent unauthorized arbitrary email sending.
>>>>>>> origin/main
 */
export async function validateRecipient(
  supabase: SupabaseClient,
  tenantId: string,
  email: string
<<<<<<< HEAD
): Promise<{ allowed: boolean; reason?: string; source?: string }> {
=======
): Promise<{ allowed: boolean; reason?: string }> {
>>>>>>> origin/main
  if (!email) {
    return { allowed: false, reason: 'Recipient email is missing.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
<<<<<<< HEAD
  if (!normalizedEmail.includes('@')) {
    return { allowed: false, reason: 'Recipient email is invalid.' };
  }

  const contactFilter = (q: any) => q.is('deleted_at', null);

  const checks = await Promise.all([
    emailExistsInColumn(supabase, 'leads', tenantId, normalizedEmail).then((ok) =>
      ok ? 'lead' : null
    ),
    emailExistsInEmailsArray(supabase, 'leads', tenantId, normalizedEmail).then((ok) =>
      ok ? 'lead_emails' : null
    ),
    emailExistsInColumn(supabase, 'contacts', tenantId, normalizedEmail, contactFilter).then((ok) =>
      ok ? 'contact' : null
    ),
    emailExistsInEmailsArray(supabase, 'contacts', tenantId, normalizedEmail, contactFilter).then(
      (ok) => (ok ? 'contact_emails' : null)
    ),
    emailExistsInColumn(supabase, 'business_clients', tenantId, normalizedEmail).then((ok) =>
      ok ? 'client' : null
    ),
    emailExistsInEmailsArray(supabase, 'business_clients', tenantId, normalizedEmail).then((ok) =>
      ok ? 'client_emails' : null
    ),
    supabase
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .filter('metadata->>client_email', 'ilike', normalizedEmail)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => (data ? 'quote' : null)),
    supabase
      .from('deals')
      .select('id, email, contact_email')
      .eq('tenant_id', tenantId)
      .limit(200)
      .then(({ data, error }) => {
        if (error || !data) return null;
        const hit = data.find((row) => {
          const a = String(row.email || '').trim().toLowerCase();
          const b = String(row.contact_email || '').trim().toLowerCase();
          return a === normalizedEmail || b === normalizedEmail;
        });
        return hit ? 'deal' : null;
      }),
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
      'Recipient email not found in your leads, contacts, clients, deals, or quotes. Add them to CRM first, or send from a module compose that already selected this contact.',
=======

  // Check if email belongs to a lead
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (lead) return { allowed: true };

  // Check if email belongs to a contact (client)
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (contact) return { allowed: true };

  return { 
    allowed: false, 
    reason: 'Recipient email not found in your leads or contacts list.' 
>>>>>>> origin/main
  };
}
