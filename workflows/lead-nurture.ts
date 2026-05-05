import { workflow, step } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Lead Nurture Workflow
 * Automated outreach sequence with conditional branching.
 */
export const leadNurtureWorkflow = workflow(async ({ leadId, tenantId }: { leadId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Send Intro Email
  await step('send-intro-email', async () => {
    console.log(`Sending intro email to lead ${leadId}`);
    await supabase.from('outreach_logs').insert({
      tenant_id: tenantId,
      lead_id: leadId,
      type: 'email',
      action: 'intro'
    });
  });

  // 2. Check for Open (Wait 2 days)
  const hasOpened = await step('check-email-open', async () => {
    // Logic to check tracking logs
    return Math.random() > 0.5;
  }, { wait: '2d' });

  if (hasOpened) {
    // 3. Send Follow-up
    await step('send-follow-up', async () => {
      console.log(`Sending follow-up to lead ${leadId}`);
    });
  } else {
    // 4. Send Nudge
    await step('send-nudge', async () => {
      console.log(`Sending nudge to lead ${leadId}`);
    });
  }

  // 5. Check for Reply (Wait 5 days)
  const hasReplied = await step('check-reply', async () => {
    return Math.random() > 0.2;
  }, { wait: '5d' });

  if (hasReplied) {
    // 6. Move to Qualified Pipeline
    await step('move-to-qualified', async () => {
      await supabase.from('leads').update({ status: 'qualified', stage: 'prospect' }).eq('id', leadId);
    });
  } else {
    // 7. Move to Cold Pipeline
    await step('move-to-cold', async () => {
      await supabase.from('leads').update({ status: 'contacted', stage: 'lead' }).eq('id', leadId);
    });
  }
});
