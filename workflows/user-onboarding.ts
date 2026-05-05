import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * User Onboarding Workflow
 * Guides new users through the first week on the platform.
 */
export async function userOnboardingWorkflow({ userId, tenantId }: { userId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Setup Workspace
  await setupWorkspace(userId);

  // 2. Send Welcome Email
  await sendWelcome(userId);

  // 3. Send Getting Started Guide (Wait 1 day)
  await sleep('1d');
  await sendGuide(userId);

  // 4. Send Activation Nudge (Wait 3 days)
  await sleep('3d');
  const hasInvoiced = await checkUsage(tenantId);

  if (!hasInvoiced) {
    await sendNudge(userId);
  }

  // 5. Send Week One Check-In (Wait 7 days)
  await sleep('7d');
  await weekOneCheckin(userId);
}

async function setupWorkspace(userId: string) {
  "use step";
  console.log(`Initializing workspace for user ${userId}`);
}

async function sendWelcome(userId: string) {
  "use step";
  console.log(`Sending welcome email to user ${userId}`);
}

async function sendGuide(userId: string) {
  "use step";
  console.log(`Sending getting started guide to user ${userId}`);
}

async function checkUsage(tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  return (count || 0) > 0;
}

async function sendNudge(userId: string) {
  "use step";
  console.log(`Sending activation nudge to user ${userId}: "Try creating your first invoice!"`);
}

async function weekOneCheckin(userId: string) {
  "use step";
  console.log(`Sending week one check-in survey to user ${userId}`);
}
