import { sleep } from 'workflow';
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
  await sleep('3d');
  await generateReport(campaignId);
}

async function dispatchCampaign(campaignId: string) {
  "use step";
  const result = await sendScheduledCampaignServer(campaignId);
  if (!result.success) {
    throw new Error(result.error || 'Campaign delivery failed');
  }
  return result;
}

async function generateReport(campaignId: string) {
  "use step";
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
}
