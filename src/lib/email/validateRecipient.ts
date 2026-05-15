import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Validates if a recipient email belongs to a lead or client in the given tenant.
 * This is a security measure to prevent unauthorized arbitrary email sending.
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
  };
}
