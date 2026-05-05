import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { contractLifecycleWorkflow } from './contract-lifecycle';

/**
 * Deal Stage Workflow
 * Automates actions when a deal moves between critical stages.
 */
export async function dealStageWorkflow({ dealId, stage, tenantId }: { dealId: string; stage: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  switch (stage) {
    case 'proposal':
      await proposalActions(dealId);
      break;

    case 'won':
      await wonActions(dealId, tenantId);
      break;

    case 'lost':
      await lostActions(dealId);
      break;
  }
}

async function proposalActions(dealId: string) {
  "use step";
  console.log(`Generating proposal for deal ${dealId}`);
}

async function wonActions(dealId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single();
  const { data: contract } = await supabase.from('contracts').insert({
    tenant_id: tenantId,
    title: `Contract for ${deal?.name}`,
    type: 'Standard Service Agreement',
    status: 'draft'
  }).select().single();

  if (contract) {
    await start(contractLifecycleWorkflow, [{ contractId: contract.id, tenantId }]);
  }
}

async function lostActions(dealId: string) {
  "use step";
  console.log(`Deal ${dealId} marked as lost. Archiving.`);
}
