import { workflow, step, start } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { contractLifecycleWorkflow } from './contract-lifecycle';

/**
 * Deal Stage Workflow
 * Automates actions when a deal moves between critical stages.
 */
export const dealStageWorkflow = workflow(async ({ dealId, stage, tenantId }: { dealId: string; stage: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  switch (stage) {
    case 'proposal':
      await step('proposal-actions', async () => {
        // Logic to generate proposal document
        console.log(`Generating proposal for deal ${dealId}`);
      });
      break;

    case 'won':
      await step('won-actions', async () => {
        // Trigger contract creation
        const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single();
        const { data: contract } = await supabase.from('contracts').insert({
          tenant_id: tenantId,
          title: `Contract for ${deal?.name}`,
          type: 'Standard Service Agreement',
          status: 'draft'
        }).select().single();

        if (contract) {
          await start(contractLifecycleWorkflow, { contractId: contract.id, tenantId });
        }
      });
      break;

    case 'lost':
      await step('lost-actions', async () => {
        // Logic for win-loss analysis
        console.log(`Deal ${dealId} marked as lost. Archiving.`);
      });
      break;
  }
});
