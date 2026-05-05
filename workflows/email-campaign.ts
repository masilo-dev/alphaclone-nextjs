import { sleep } from 'workflow';
import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { leadNurtureWorkflow } from './lead-nurture';

/**
 * Email Campaign Workflow
 * Manages bulk email dispatch and performance reporting.
 */
export async function emailCampaignWorkflow({ campaignId, tenantId }: { campaignId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Send Campaign Emails
  const recipients = await getRecipients(campaignId, tenantId);

  await sendEmails(campaignId, recipients, tenantId);

  // 2. Wait 3 days for engagement
  await sleep('3d');
  await generateReport(campaignId);
}

async function getRecipients(campaignId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: campaign } = await supabase.from('email_campaigns').select('target_audience').eq('id', campaignId).single();
  const { data: leads } = await supabase.from('leads').select('id, email').eq('tenant_id', tenantId).limit(10);
  return leads || [];
}

async function sendEmails(campaignId: string, recipients: any[], tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  for (const recipient of recipients) {
    console.log(`Sending campaign ${campaignId} to ${recipient.email}`);
    await start(leadNurtureWorkflow, [{ leadId: recipient.id, tenantId }]);
  }
  await supabase.from('email_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', campaignId);
}

async function generateReport(campaignId: string) {
  "use step";
  console.log(`Generating performance report for campaign ${campaignId}`);
}
