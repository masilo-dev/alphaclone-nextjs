import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';
import { escapeHtml } from '@/lib/email/sanitizeEmailHtml';

export interface DailyOperationsSummary {
  tenantId: string;
  tenantName: string;
  today: {
    newLeads: number;
    qualifiedLeads: number;
    newClients: number;
    proposalsSent: number;
    proposalsAccepted: number;
    meetingsCompleted: number;
    projectsCreated: number;
    tasksCompleted: number;
    paymentsReceivedAmount: number;
  };
  needsAttention: {
    unansweredEmails: number;
    overdueInvoices: number;
    projectsAtRisk: number;
    failedActionsCount: number;
    details: string[];
  };
  waitingOn: string[];
  tomorrow: string[];
}

/**
 * Collects 24-hour operations metrics and generates an executive business summary.
 */
export async function collectDailyOperationsSummary(
  tenantId: string
): Promise<DailyOperationsSummary> {
  const admin = createSupabaseAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();

  const tenantName = tenant?.name || 'AlphaClone Workspace';

  // 1. Fetch Today's Activity Metrics
  const [
    { count: newLeads },
    { count: qualifiedLeads },
    { count: newClients },
    { count: proposalsSent },
    { count: proposalsAccepted },
    { count: meetingsCompleted },
    { count: projectsCreated },
    { count: tasksCompleted },
    { data: paymentsData },
  ] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'qualified').gte('created_at', since24h),
    admin.from('business_clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h),
    admin.from('quotes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h),
    admin.from('quotes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'accepted').gte('updated_at', since24h),
    admin.from('meetings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'completed').gte('updated_at', since24h),
    admin.from('business_projects').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', since24h),
    admin.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'completed').gte('updated_at', since24h),
    admin.from('invoices').select('amount_paid').eq('tenant_id', tenantId).gte('created_at', since24h),
  ]);

  const paymentsReceivedAmount = (paymentsData || []).reduce(
    (sum: number, item: any) => sum + (Number(item.amount_paid) || 0),
    0
  );

  // 2. Fetch Needs Attention Items
  const [
    { count: overdueInvoices },
    { count: projectsAtRisk },
    { data: failedAuditLogs },
    { data: unansweredEmailsData },
  ] = await Promise.all([
    admin.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'overdue'),
    admin.from('business_projects').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['at_risk', 'blocked']),
    admin.from('audit_logs').select('action, metadata').eq('tenant_id', tenantId).eq('severity', 'high').gte('created_at', since24h).limit(5),
    admin.from('emails').select('subject, sender').eq('tenant_id', tenantId).eq('status', 'unanswered').limit(5),
  ]);

  const unansweredEmails = unansweredEmailsData?.length || 0;
  const failedActionsCount = failedAuditLogs?.length || 0;
  const attentionDetails: string[] = [];

  if (unansweredEmails > 0) attentionDetails.push(`${unansweredEmails} client emails awaiting response`);
  if ((overdueInvoices || 0) > 0) attentionDetails.push(`${overdueInvoices} overdue invoices require payment follow-up`);
  if ((projectsAtRisk || 0) > 0) attentionDetails.push(`${projectsAtRisk} projects marked at risk or blocked`);
  if (failedActionsCount > 0) attentionDetails.push(`${failedActionsCount} publishing or integration failures recorded`);

  // 3. Fetch Waiting On Items
  const { data: pendingContracts } = await admin
    .from('contracts')
    .select('title')
    .eq('tenant_id', tenantId)
    .eq('status', 'sent_for_signature')
    .limit(3);

  const waitingOn: string[] = (pendingContracts || []).map(
    (c: any) => `Pending signature: ${c.title || 'Contract'}`
  );
  if (waitingOn.length === 0) {
    waitingOn.push('No pending client signature blocks');
  }

  // 4. Fetch Tomorrow's Items
  const tomorrowStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: upcomingMeetings } = await admin
    .from('meetings')
    .select('title, start_time')
    .eq('tenant_id', tenantId)
    .gte('start_time', tomorrowStart)
    .limit(3);

  const tomorrow: string[] = (upcomingMeetings || []).map(
    (m: any) => `Meeting: ${m.title || 'Client meeting'}`
  );
  if (tomorrow.length === 0) {
    tomorrow.push('Follow up with active pipeline opportunities');
  }

  return {
    tenantId,
    tenantName,
    today: {
      newLeads: newLeads || 0,
      qualifiedLeads: qualifiedLeads || 0,
      newClients: newClients || 0,
      proposalsSent: proposalsSent || 0,
      proposalsAccepted: proposalsAccepted || 0,
      meetingsCompleted: meetingsCompleted || 0,
      projectsCreated: projectsCreated || 0,
      tasksCompleted: tasksCompleted || 0,
      paymentsReceivedAmount,
    },
    needsAttention: {
      unansweredEmails,
      overdueInvoices: overdueInvoices || 0,
      projectsAtRisk: projectsAtRisk || 0,
      failedActionsCount,
      details: attentionDetails,
    },
    waitingOn,
    tomorrow,
  };
}

/**
 * Format executive daily digest HTML email.
 */
export function formatDailyOperationsDigestHtml(summary: DailyOperationsSummary): string {
  const dashboardUrl = defaultDashboardUrl();

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #0f172a; padding: 28px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8;">AlphaClone Daily Operations</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">Workspace: ${escapeHtml(summary.tenantName)}</p>
      </div>

      <div style="padding: 24px; color: #1e293b;">
        <h2 style="font-size: 16px; font-weight: 700; color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0;">Today</h2>
        <ul style="padding-left: 20px; font-size: 14px; line-height: 1.8; color: #334155;">
          <li><strong>${summary.today.newLeads}</strong> new leads</li>
          <li><strong>${summary.today.qualifiedLeads}</strong> qualified</li>
          <li><strong>${summary.today.newClients}</strong> new client</li>
          <li><strong>${summary.today.proposalsSent}</strong> proposals sent</li>
          <li><strong>${summary.today.proposalsAccepted}</strong> proposal accepted</li>
          <li><strong>${summary.today.meetingsCompleted}</strong> meetings completed</li>
          <li><strong>${summary.today.projectsCreated}</strong> new project created</li>
          <li><strong>${summary.today.tasksCompleted}</strong> project tasks completed</li>
          <li><strong>$${summary.today.paymentsReceivedAmount.toLocaleString()}</strong> payment received</li>
        </ul>

        <h2 style="font-size: 16px; font-weight: 700; color: #dc2626; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px;">Needs Attention</h2>
        ${
          summary.needsAttention.details.length > 0
            ? `<ul style="padding-left: 20px; font-size: 14px; line-height: 1.8; color: #b91c1c;">
                ${summary.needsAttention.details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>`
            : `<p style="font-size: 14px; color: #16a34a;">No critical issues requiring urgent attention.</p>`
        }

        <h2 style="font-size: 16px; font-weight: 700; color: #d97706; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px;">Waiting On</h2>
        <ul style="padding-left: 20px; font-size: 14px; line-height: 1.8; color: #475569;">
          ${summary.waitingOn.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>

        <h2 style="font-size: 16px; font-weight: 700; color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 24px;">Tomorrow</h2>
        <ul style="padding-left: 20px; font-size: 14px; line-height: 1.8; color: #475569;">
          ${summary.tomorrow.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>

        <div style="margin-top: 32px; text-align: center;">
          <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 12px 28px; background: #0284c7; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px;">Open AlphaClone OS</a>
        </div>
      </div>

      <div style="padding: 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
        AlphaClone Systems Business Operating System · Executive Operations Briefing
      </div>
    </div>
  `;
}

/**
 * Dispatch daily digest email to tenant owners/administrators.
 */
export async function sendDailyOperationsDigest(tenantId: string): Promise<{ success: boolean; emailsSent: number; error?: string }> {
  const admin = createSupabaseAdminClient();
  const summary = await collectDailyOperationsSummary(tenantId);
  const html = formatDailyOperationsDigestHtml(summary);

  const { data: owners } = await admin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin', 'tenant_admin', 'super_admin']);

  if (!owners || owners.length === 0) {
    return { success: true, emailsSent: 0 };
  }

  let sentCount = 0;
  for (const owner of owners) {
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', owner.user_id)
      .maybeSingle();

    if (profile?.email) {
      const res = await sendEmailServer({
        tenantId,
        userId: owner.user_id,
        to: profile.email,
        subject: `AlphaClone Daily Operations — ${summary.tenantName}`,
        html,
        isPlatformNotification: true,
        templateName: 'daily_operations_digest',
      });
      if (res.success) sentCount++;
    }
  }

  return { success: true, emailsSent: sentCount };
}
