import { workflow, step } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * User Onboarding Workflow
 * Guides new users through the first week on the platform.
 */
export const userOnboardingWorkflow = workflow(async ({ userId, tenantId }: { userId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Setup Workspace
  await step('setup-workspace', async () => {
    console.log(`Initializing workspace for user ${userId}`);
    // Logic to create default categories, settings, etc.
  });

  // 2. Send Welcome Email
  await step('send-welcome', async () => {
    console.log(`Sending welcome email to user ${userId}`);
  });

  // 3. Send Getting Started Guide (Wait 1 day)
  await step('send-guide', async () => {
    console.log(`Sending getting started guide to user ${userId}`);
  }, { wait: '1d' });

  // 4. Send Activation Nudge (Wait 3 days)
  const hasInvoiced = await step('check-usage', async () => {
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    return (count || 0) > 0;
  }, { wait: '3d' });

  if (!hasInvoiced) {
    await step('send-nudge', async () => {
      console.log(`Sending activation nudge to user ${userId}: "Try creating your first invoice!"`);
    });
  }

  // 5. Send Week One Check-In (Wait 7 days)
  await step('week-one-checkin', async () => {
    console.log(`Sending week one check-in survey to user ${userId}`);
  }, { wait: '7d' });
});
