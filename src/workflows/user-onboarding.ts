import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  SYSTEM_PLATFORM_TEMPLATES,
  defaultDashboardUrl,
  sendPlatformTemplateEmail,
} from '@/lib/email/platformTemplateEmail';

type UserContext = {
  email: string;
  name: string;
};

/**
 * User Onboarding Workflow
 * Sends real lifecycle emails and prepares a few default workspace resources.
 */
export async function userOnboardingWorkflow({ userId, tenantId }: { userId: string; tenantId: string }) {
  "use workflow";

  await setupWorkspace(userId, tenantId);
  await sendWelcome(userId, tenantId);

  await sleep('1d');
  await sendGuide(userId, tenantId);

  await sleep('3d');
  const usage = await checkUsage(tenantId);

  if (!usage.hasCoreActivation) {
    await sendNudge(userId, tenantId, usage);
  }

  await sleep('7d');
  await weekOneCheckin(userId, tenantId, usage);
}

async function setupWorkspace(userId: string, tenantId: string) {
  "use step";

  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  const [{ error: accountsError }, { error: activityError }] = await Promise.all([
    supabase.rpc('create_default_chart_of_accounts', { p_tenant_id: tenantId }),
    supabase.from('activity_logs').insert({
      user_id: userId,
      tenant_id: tenantId,
      action: 'ONBOARDING_STARTED',
      metadata: {
        workflow: 'user_onboarding',
        source: 'activation_lifecycle',
      },
    }),
  ]);

  if (accountsError) {
    console.warn('[userOnboardingWorkflow] chart of accounts setup skipped:', accountsError.message);
  }

  if (activityError) {
    console.warn('[userOnboardingWorkflow] activity log insert skipped:', activityError.message);
  }
}

async function sendWelcome(userId: string, tenantId: string) {
  "use step";
  await sendLifecycleEmail(userId, tenantId, 'Welcome Email', {}, true);
}

async function sendGuide(userId: string, tenantId: string) {
  "use step";
  await sendLifecycleEmail(userId, tenantId, 'Morning Briefing', {
    dashboardUrl: `${defaultDashboardUrl()}/dashboard/business`,
    focusArea: 'Complete one activation step and one revenue step today.',
  });
}

async function checkUsage(tenantId: string) {
  "use step";

  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  const [invoiceRes, leadRes, dealRes, socialRes] = await Promise.all([
    supabase.from('business_invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  const invoiceCount = invoiceRes.count || 0;
  const leadCount = leadRes.count || 0;
  const dealCount = dealRes.count || 0;
  const socialCount = socialRes.count || 0;

  return {
    invoiceCount,
    leadCount,
    dealCount,
    socialCount,
    hasCoreActivation: invoiceCount > 0 || leadCount > 0 || dealCount > 0 || socialCount > 0,
  };
}

async function sendNudge(
  userId: string,
  tenantId: string,
  usage: { invoiceCount: number; leadCount: number; dealCount: number; socialCount: number }
) {
  "use step";

  const lowestSignalArea =
    usage.leadCount === 0 ? 'finding your first lead' :
    usage.dealCount === 0 ? 'creating your first deal' :
    usage.socialCount === 0 ? 'scheduling your first post' :
    'sending your first invoice';

  await sendLifecycleEmail(userId, tenantId, 'Stay In Touch', {
    dashboardUrl: `${defaultDashboardUrl()}/dashboard/business`,
    focusArea: `You are one action away from momentum. Start with ${lowestSignalArea}.`,
  });
}

async function weekOneCheckin(
  userId: string,
  tenantId: string,
  usage: { invoiceCount: number; leadCount: number; dealCount: number; socialCount: number; hasCoreActivation: boolean }
) {
  "use step";

  await sendLifecycleEmail(userId, tenantId, usage.hasCoreActivation ? 'AI and Leads Status' : 'Daily Motivation', {
    dashboardUrl: `${defaultDashboardUrl()}/dashboard/business`,
    focusArea: usage.hasCoreActivation
      ? `Week-one snapshot: ${usage.leadCount} leads, ${usage.dealCount} deals, ${usage.invoiceCount} invoices, ${usage.socialCount} social posts.`
      : 'Week one is the right time to complete your first real workflow inside the app.',
  });
}

async function getUserContext(userId: string): Promise<UserContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user?.email) {
    console.warn('[userOnboardingWorkflow] user lookup failed:', error?.message || 'Missing email');
    return null;
  }

  return {
    email: data.user.email.toLowerCase().trim(),
    name:
      (data.user.user_metadata?.name as string | undefined) ||
      data.user.email.split('@')[0] ||
      'there',
  };
}

async function sendLifecycleEmail(
  userId: string,
  tenantId: string,
  templateName: string,
  variables: Record<string, string | number>,
  skipIfWelcomeAlreadySent = false
) {
  const supabase = createSupabaseAdminClient();
  const membership = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membership.error || !membership.data) {
    console.warn('[userOnboardingWorkflow] skipped email — user not in tenant:', templateName);
    return;
  }

  const user = await getUserContext(userId);
  if (!user) return;

  const result = await sendPlatformTemplateEmail(supabase, {
    templateName,
    to: user.email,
    variables: {
      name: user.name,
      email: user.email,
      dashboardUrl: `${defaultDashboardUrl()}/dashboard/business`,
      ...variables,
    },
    credentialUserId: userId,
    templateAllowlist: SYSTEM_PLATFORM_TEMPLATES,
    authUserId: userId,
    skipIfWelcomeAlreadySent,
  });

  if (!result.success && !result.skipped) {
    console.warn(`[userOnboardingWorkflow] failed to send ${templateName}:`, result.error);
  }
}
