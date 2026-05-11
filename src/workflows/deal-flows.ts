import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateText } from '@/services/unifiedAIService';

/**
 * Deal Stage Changed Workflow
 * Triggered when a deal moves to a specific stage (e.g., 'closed_won').
 */
export async function dealStageChangedWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { dealId, newStage } = payload;
  if (newStage !== 'closed_won') return;

  // 1. Create Project
  const project = await createProjectStep(dealId, tenantId);

  // 2. Generate Contract Draft via AI
  if (project) {
    await generateContractDraftStep(project.id, tenantId);
  }

  // 3. Notify Owner
  await notifyOwnerStep(dealId, tenantId);
}

async function createProjectStep(dealId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: deal } = await supabase.from('deals').select('*').eq('id', dealId).single();
  
  const { data: project } = await supabase.from('projects').insert({
    tenant_id: tenantId,
    name: `Project: ${deal?.name || 'New Deal'}`,
    deal_id: dealId,
    status: 'active'
  }).select().single();
  
  return project;
}

async function generateContractDraftStep(projectId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: project } = await supabase.from('projects').select('*, deals(*)').eq('id', projectId).single();
  
  const prompt = `Generate a professional service contract draft for project "${project?.name}". 
  Client: ${project?.deals?.client_name || 'Valued Client'}. 
  Terms: Standard business terms.`;
  
  const aiResponse = await generateText(prompt, 2048);
  
  await supabase.from('contracts').insert({
    tenant_id: tenantId,
    project_id: projectId,
    title: `Contract - ${project?.name}`,
    content: aiResponse.text || 'Draft pending AI generation...',
    status: 'draft'
  });
}

async function notifyOwnerStep(dealId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: deal } = await supabase.from('deals').select('owner_id').eq('id', dealId).single();
  
  if (deal?.owner_id) {
    await supabase.from('notifications').insert({
      user_id: deal.owner_id,
      tenant_id: tenantId,
      title: 'Deal Closed Won! 🚀',
      message: 'A new project and contract draft have been created automatically.',
      type: 'success'
    });
  }
}
