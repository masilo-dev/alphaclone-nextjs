/**
 * Shared contract lifecycle steps for Workflow SDK and Bonnie durable runtime.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function markContractSentForSignature(
  contractId: string,
  tenantId: string
): Promise<{ contract_id: string; status: string }> {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  const { data, error } = await supabase
    .from('contracts')
    .update({ status: 'sent', lifecycle_status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', contractId)
    .eq('tenant_id', tenantId)
    .select('id, status, lifecycle_status')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Contract ${contractId} not found`);

  return { contract_id: data.id, status: String(data.lifecycle_status || data.status) };
}
