import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Lead Nurture Workflow
 * Automated outreach sequence with conditional branching.
 */
export async function leadNurtureWorkflow({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Send Intro Email
  await sendIntroEmail(leadId, tenantId);

  // 2. Check for Open (Wait 2 days)
  await sleep('2d');
  const hasOpened = await checkEmailOpen(leadId);

  if (hasOpened) {
    // 3. Send Follow-up
    await sendFollowUp(leadId);
  } else {
    // 4. Send Nudge
    await sendNudge(leadId);
  }

  // 5. Check for Reply (Wait 5 days)
  await sleep('5d');
  const hasReplied = await checkReply(leadId);

  if (hasReplied) {
    // 6. Move to Qualified Pipeline
    await moveToQualified(leadId, tenantId);
  } else {
    // 7. Move to Cold Pipeline
    await moveToCold(leadId, tenantId);
  }
}

async function sendIntroEmail(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`Sending intro email to lead ${leadId}`);
  await supabase.from('outreach_logs').insert({
    tenant_id: tenantId,
    lead_id: leadId,
    type: 'email',
    action: 'intro'
  });
}

async function checkEmailOpen(leadId: string) {
  "use step";
  return Math.random() > 0.5;
}

async function sendFollowUp(leadId: string) {
  "use step";
  console.log(`Sending follow-up to lead ${leadId}`);
}

async function sendNudge(leadId: string) {
  "use step";
  console.log(`Sending nudge to lead ${leadId}`);
}

async function checkReply(leadId: string) {
  "use step";
  return Math.random() > 0.2;
}

async function moveToQualified(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  await supabase.from('leads').update({ status: 'qualified', stage: 'prospect' }).eq('id', leadId);
}

async function moveToCold(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  await supabase.from('leads').update({ status: 'contacted', stage: 'lead' }).eq('id', leadId);
}
