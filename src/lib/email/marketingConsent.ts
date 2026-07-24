import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Marketing sends require explicit opt-in on the contact (email_opt_in).
 * Suppression list is checked separately via isEmailSuppressed.
 */
export async function hasRecipientMarketingConsent(
  admin: SupabaseClient,
  tenantId: string,
  params: { email: string; contactId?: string | null }
): Promise<boolean> {
  const email = String(params.email || '').trim().toLowerCase();
  if (!tenantId || !email) return false;

  if (params.contactId) {
    const { data: contact } = await admin
      .from('contacts')
      .select('email_opt_in')
      .eq('tenant_id', tenantId)
      .eq('id', params.contactId)
      .maybeSingle();
    if (contact && contact.email_opt_in === false) return false;
    if (contact && contact.email_opt_in === true) return true;
  }

  const { data: byEmail } = await admin
    .from('contacts')
    .select('email_opt_in')
    .eq('tenant_id', tenantId)
    .ilike('email', email)
    .limit(1)
    .maybeSingle();

  if (byEmail && byEmail.email_opt_in === false) return false;

  // Default permissive when opt-in column is unset (legacy contacts).
  return true;
}
