import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Lead Created Workflow
 * Triggered when a new lead is added to the system.
 */
export async function leadCreatedWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";

  const { leadId } = payload;
  if (!tenantId || !leadId) return;

  const score = await scoreLeadStep(leadId, tenantId);
  await autoAssignOwnerStep(leadId, tenantId);
  if (score > 50) {
    await recordNurtureEligibilityStep(leadId, tenantId);
  }
}

async function scoreLeadStep(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, phone, website, email')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return 0;

  let score = 20;
  if (lead.phone) score += 30;
  if (lead.website) score += 30;
  if (lead.email) score += 20;

  await supabase.from('leads').update({ score }).eq('tenant_id', tenantId).eq('id', leadId);
  return score;
}

async function recordNurtureEligibilityStep(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.from('automation_runs').insert({
    workflow_type: 'lead_nurture_eligible',
    tenant_id: tenantId,
    status: 'running',
    steps: [{ action: 'nurture_eligible', leadId, at: new Date().toISOString() }],
  });
}

async function autoAssignOwnerStep(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: members } = await supabase
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin', 'tenant_admin', 'member'])
    .limit(5);

  const owner = (members || []).find((m: { role: string }) => m.role === 'owner') || members?.[0];
  if (!owner?.user_id) return;

  await supabase
    .from('leads')
    .update({ owner_id: owner.user_id })
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .is('owner_id', null);
}
