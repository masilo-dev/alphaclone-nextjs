import { queueContractLifecycle } from '@/lib/contracts/durableContractRouter';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateText } from '@/services/unifiedAIService';

/**
 * Deal Stage Changed Workflow
 * Canonical order: closed_won → contract draft → send for signature.
 * Invoice and project are created after contract_signed (see contract-flows.ts).
 */
export async function dealStageChangedWorkflow({ tenantId, payload }: { tenantId: string; payload: Record<string, unknown> }) {
  "use workflow";

  const dealId = String(payload.dealId || '');
  const newStage = String(payload.newStage || '');
  if (!dealId) return;

  if (newStage === 'proposal') {
    await proposalActions(dealId, tenantId);
    return;
  }

  if (newStage !== 'closed_won') return;

  const contract = await createContractDraftStep(dealId, tenantId);
  if (contract?.id) {
    await queueContractLifecycle({ contractId: contract.id, tenantId });
  }
  await notifyOwnerStep(dealId, tenantId);
}

async function proposalActions(dealId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { ensureDealProposalArtifacts } = await import('@/lib/crm/dealProposalServer');
  await ensureDealProposalArtifacts(supabase, dealId, tenantId);
}

async function createContractDraftStep(dealId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single();
  if (!deal) return null;

  const prompt = `Generate a professional service contract draft for deal "${deal.name}".
Client: ${deal.contact_name || 'Valued Client'}.
Value: ${deal.value || 0}.
Terms: Standard business terms.`;

  const aiResponse = await generateText(prompt, 2048);

  const { data: contract } = await supabase
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      title: `Contract — ${deal.name}`,
      type: 'Standard Service Agreement',
      status: 'draft',
      content: aiResponse.text || 'Draft pending AI generation...',
      client_id: deal.contact_id || null,
      metadata: { deal_id: dealId, source: 'deal_closed_won' },
    })
    .select()
    .single();

  return contract;
}

async function notifyOwnerStep(dealId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: deal } = await supabase.from('deals').select('owner_id, name').eq('id', dealId).single();

  if (deal?.owner_id) {
    await supabase.from('notifications').insert({
      user_id: deal.owner_id,
      tenant_id: tenantId,
      title: 'Deal closed won — contract ready',
      message: `Contract draft created for "${deal.name}". Send for signature, then invoice, then kick off the project.`,
      type: 'success',
    });
  }
}
