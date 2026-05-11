import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Lead Created Workflow
 * Triggered when a new lead is added to the system.
 */
export async function leadCreatedWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { leadId } = payload;

  // 1. Score Deal (AI or Heuristic)
  const score = await scoreLeadStep(leadId, tenantId);

  // 2. Start Lead Nurture Sequence
  if (score > 50) {
    await startNurtureSequenceStep(leadId, tenantId);
  }

  // 3. Assign Owner
  await autoAssignOwnerStep(leadId, tenantId);
}

async function scoreLeadStep(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  
  // Simple heuristic for demo: presence of phone + website
  let score = 20;
  if (lead?.phone) score += 30;
  if (lead?.website) score += 30;
  if (lead?.email) score += 20;

  await supabase.from('leads').update({ score }).eq('id', leadId);
  return score;
}

async function startNurtureSequenceStep(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  console.log(`[Automation] Starting nurture sequence for lead ${leadId}`);
  
  await supabase.from('automation_runs').insert({
    workflow_type: 'lead_nurture',
    tenant_id: tenantId,
    status: 'running',
    steps: [{ action: 'nurture_started', at: new Date().toISOString() }]
  });
}

async function autoAssignOwnerStep(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  // Fetch least busy user
  const { data: users } = await supabase.from('users').select('id').limit(1); // Simplification
  
  if (users?.[0]) {
    await supabase.from('leads').update({ owner_id: users[0].id }).eq('id', leadId);
  }
}
