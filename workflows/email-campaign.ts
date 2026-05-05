import { workflow, step, start } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { leadNurtureWorkflow } from './lead-nurture';

/**
 * Email Campaign Workflow
 * Manages bulk email dispatch and performance reporting.
 */
export const emailCampaignWorkflow = workflow(async ({ campaignId, tenantId }: { campaignId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Send Campaign Emails
  const recipients = await step('get-recipients', async () => {
    const { data: campaign } = await supabase.from('email_campaigns').select('target_audience').eq('id', campaignId).single();
    // Simplified: fetch leads matching audience
    const { data: leads } = await supabase.from('leads').select('id, email').eq('tenant_id', tenantId).limit(10);
    return leads || [];
  });

  await step('send-emails', async () => {
    for (const recipient of recipients) {
      console.log(`Sending campaign ${campaignId} to ${recipient.email}`);
      // Start a nurture workflow for each recipient
      await start(leadNurtureWorkflow, { leadId: recipient.id, tenantId });
    }
    await supabase.from('email_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', campaignId);
  });

  // 2. Wait 3 days for engagement
  await step('generate-report', async () => {
    console.log(`Generating performance report for campaign ${campaignId}`);
    // Aggregation logic
  }, { wait: '3d' });
});
