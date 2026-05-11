import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Contract Signed Workflow
 * Triggered when a contract status changes to 'signed'.
 */
export async function contractSignedWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { contractId } = payload;

  // 1. Kickoff Project Automation
  const project = await kickoffProjectStep(contractId, tenantId);

  // 2. Notify Client (Welcome Package)
  if (project) {
    await sendWelcomePackageStep(project.id, tenantId);
  }

  // 3. Mark Deal as Closed Won (if not already)
  await syncDealStatusStep(contractId, tenantId);
}

async function kickoffProjectStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).single();
  
  const { data: project } = await supabase.from('projects').insert({
    tenant_id: tenantId,
    name: `Project: ${contract?.title || 'Signed Project'}`,
    contract_id: contractId,
    status: 'active'
  }).select().single();
  
  return project;
}

async function sendWelcomePackageStep(projectId: string, tenantId: string) {
  "use step";
  console.log(`[Automation] Sending welcome package for project ${projectId}`);
}

async function syncDealStatusStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: contract } = await supabase.from('contracts').select('project_id').eq('id', contractId).single();
  
  if (contract?.project_id) {
    const { data: project } = await supabase.from('projects').select('deal_id').eq('id', contract.project_id).single();
    if (project?.deal_id) {
       await supabase.from('deals').update({ stage: 'closed_won' }).eq('id', project.deal_id);
    }
  }
}
