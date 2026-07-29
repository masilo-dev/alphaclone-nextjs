import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { contractLifecycleWorkflow } from './contract-lifecycle';

<<<<<<< HEAD
/** Normalize legacy stage names to canonical deal stages. */
function normalizeDealStage(stage: string): string {
  if (stage === 'won') return 'closed_won';
  if (stage === 'lost') return 'closed_lost';
  return stage;
}

/**
 * Deal Stage Workflow — MCP/manual trigger when a deal hits a critical stage.
 */
export async function dealStageWorkflow({ dealId, stage, tenantId }: { dealId: string; stage: string; tenantId: string }) {
  "use workflow";

  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  const normalized = normalizeDealStage(stage);

  switch (normalized) {
    case 'proposal':
      await proposalActions(dealId);
      break;
    case 'closed_won':
      await closedWonActions(dealId, tenantId);
      break;
    case 'closed_lost':
=======
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
>>>>>>> origin/main
      await lostActions(dealId);
      break;
  }
}

async function proposalActions(dealId: string) {
  "use step";
<<<<<<< HEAD
  const supabase = createSupabaseAdminClient();
  const { data: deal } = await supabase.from('deals').select('tenant_id').eq('id', dealId).maybeSingle();
  if (!deal?.tenant_id) return;
  const { ensureDealProposalArtifacts } = await import('@/lib/crm/dealProposalServer');
  await ensureDealProposalArtifacts(supabase, dealId, deal.tenant_id);
}

async function closedWonActions(dealId: string, tenantId: string) {
=======
  console.log(`Generating proposal for deal ${dealId}`);
}

async function wonActions(dealId: string, tenantId: string) {
>>>>>>> origin/main
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single();
<<<<<<< HEAD
  const { data: contract } = await supabase
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      title: `Contract for ${deal?.name}`,
      type: 'Standard Service Agreement',
      status: 'draft',
      client_id: deal?.contact_id || null,
      metadata: { deal_id: dealId, source: 'deal_stage_workflow' },
    })
    .select()
    .single();
=======
  const { data: contract } = await supabase.from('contracts').insert({
    tenant_id: tenantId,
    title: `Contract for ${deal?.name}`,
    type: 'Standard Service Agreement',
    status: 'draft'
  }).select().single();
>>>>>>> origin/main

  if (contract) {
    await start(contractLifecycleWorkflow, [{ contractId: contract.id, tenantId }]);
  }
}

async function lostActions(dealId: string) {
  "use step";
<<<<<<< HEAD
  console.log(`[deal-stage] Deal ${dealId} marked lost — archive follow-ups`);
=======
  console.log(`Deal ${dealId} marked as lost. Archiving.`);
>>>>>>> origin/main
}
