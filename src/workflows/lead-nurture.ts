import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { sendEmailServer } from '@/lib/email/sendEmailServer';
=======
>>>>>>> origin/main

/**
 * Lead Nurture Workflow
 * Automated outreach sequence with conditional branching.
 */
export async function leadNurtureWorkflow({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  "use workflow";
<<<<<<< HEAD
  const startedAt = new Date().toISOString();
=======
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
>>>>>>> origin/main

  // 1. Send Intro Email
  await sendIntroEmail(leadId, tenantId);

  // 2. Check for Open (Wait 2 days)
  await sleep('2d');
<<<<<<< HEAD
  const repliedEarly = await checkReply(leadId, tenantId, startedAt);
  if (!repliedEarly) await sendFollowUp(leadId, tenantId);

  // 5. Check for Reply (Wait 5 days)
  await sleep('5d');
  const hasReplied = await checkReply(leadId, tenantId, startedAt);
=======
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
>>>>>>> origin/main

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
<<<<<<< HEAD
  const lead = await loadLead(leadId, tenantId);
  const result = await sendEmailServer({ tenantId, to: lead.email, subject: `A quick introduction for ${lead.business_name || 'your team'}`, text: `Hello,\n\nI wanted to introduce our team and learn whether we can help with your current business priorities. If this is relevant, reply with a convenient time for a short conversation.\n\nBest regards`, templateName: 'lead-nurture-intro' });
  if (!result.success) throw new Error(result.error || 'Intro email could not be delivered');
}

async function loadLead(leadId: string, tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('leads').select('id, email, business_name').eq('id', leadId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (!data?.email) throw new Error('Lead does not have a deliverable email address');
  return data;
}

async function sendFollowUp(leadId: string, tenantId: string) {
  "use step";
  const lead = await loadLead(leadId, tenantId);
  const result = await sendEmailServer({ tenantId, to: lead.email, subject: `Following up: ${lead.business_name || 'your priorities'}`, text: `Hello,\n\nI’m following up on my earlier note. If improving your current workflow is a priority, reply with the area you would most like to improve and we can suggest a concrete next step.\n\nBest regards`, templateName: 'lead-nurture-follow-up' });
  if (!result.success) throw new Error(result.error || 'Follow-up email could not be delivered');
}

async function checkReply(leadId: string, tenantId: string, since: string) {
  "use step";
  const lead = await loadLead(leadId, tenantId);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('unified_messages').select('id').eq('tenant_id', tenantId).eq('direction', 'inbound').ilike('from_address', lead.email).gte('created_at', since).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
=======
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
>>>>>>> origin/main
}

async function moveToQualified(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
<<<<<<< HEAD
  const { error } = await supabase.from('leads').update({ status: 'qualified', stage: 'prospect' }).eq('id', leadId).eq('tenant_id', tenantId);
  if (error) throw error;
=======
  await supabase.from('leads').update({ status: 'qualified', stage: 'prospect' }).eq('id', leadId);
>>>>>>> origin/main
}

async function moveToCold(leadId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
<<<<<<< HEAD
  const { error } = await supabase.from('leads').update({ status: 'contacted', stage: 'lead' }).eq('id', leadId).eq('tenant_id', tenantId);
  if (error) throw error;
=======
  await supabase.from('leads').update({ status: 'contacted', stage: 'lead' }).eq('id', leadId);
>>>>>>> origin/main
}
