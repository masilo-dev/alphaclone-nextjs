import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Contract Lifecycle Workflow — send for signature only.
 * After signature: invoice → project (contractSignedWorkflow in contract-flows.ts).
 */
export async function contractLifecycleWorkflow({ contractId, tenantId }: { contractId: string; tenantId: string }) {
  "use workflow";

  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  await sendForSignature(contractId, tenantId);
}

async function sendForSignature(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`[contract-lifecycle] Sending contract ${contractId} for signature`);
  await supabase.from('contracts').update({ status: 'sent' }).eq('id', contractId);
}
