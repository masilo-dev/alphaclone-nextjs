import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Validates if a recipient email belongs to a lead, contact, or business client in the tenant.
 * Used to gate bulk outreach; direct compose from CRM should match business_clients.
 */
export async function validateRecipient(
  supabase: SupabaseClient,
  tenantId: string,
  email: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (!email) {
    return { allowed: false, reason: 'Recipient email is missing.' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [leadResult, contactResult, clientResult, quoteResult] = await Promise.all([
    supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('business_clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .filter('metadata->>client_email', 'ilike', normalizedEmail)
      .limit(1)
      .maybeSingle(),
  ]);

  if (leadResult.data) return { allowed: true };
  if (contactResult.data) return { allowed: true };
  if (clientResult.data) return { allowed: true };
  if (quoteResult.data) return { allowed: true };

  return {
    allowed: false,
    reason: 'Recipient email not found in your leads, contacts, or clients list.',
  };
}
