import { sleep } from 'workflow';
<<<<<<< HEAD
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendScheduledCampaignServer } from '@/lib/server/sendScheduledCampaignServer';

/**
 * Email Campaign Workflow
 * Mirrors the production campaign sender by delegating to sendScheduledCampaignServer.
 * This keeps workflow-triggered sends aligned with the dashboard/API delivery path.
 */
export async function emailCampaignWorkflow({ campaignId, tenantId }: { campaignId: string; tenantId: string }) {
  "use workflow";

  await dispatchCampaign(campaignId);
=======
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
>>>>>>> origin/main
  await sleep('3d');
  await generateReport(campaignId);
}

<<<<<<< HEAD
async function dispatchCampaign(campaignId: string) {
  "use step";
  const result = await sendScheduledCampaignServer(campaignId);
  if (!result.success) {
    throw new Error(result.error || 'Campaign delivery failed');
  }
  return result;
=======
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
>>>>>>> origin/main
}

async function generateReport(campaignId: string) {
  "use step";
<<<<<<< HEAD
  const supabase = createSupabaseAdminClient();
  const { data: campaign } = await supabase
    .from('email_campaigns')
    .select('total_sent, total_opened, total_clicked, total_bounced, total_unsubscribed')
    .eq('id', campaignId)
    .maybeSingle();

  console.log('Campaign performance snapshot', {
    campaignId,
    sent: campaign?.total_sent || 0,
    opened: campaign?.total_opened || 0,
    clicked: campaign?.total_clicked || 0,
    bounced: campaign?.total_bounced || 0,
    unsubscribed: campaign?.total_unsubscribed || 0,
  });
=======
  console.log(`Generating performance report for campaign ${campaignId}`);
>>>>>>> origin/main
}
