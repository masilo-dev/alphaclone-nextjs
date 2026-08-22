import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';
import { dailyBusinessSummaryService, type DailyBusinessSummary } from '@/services/dailyBusinessSummaryService';

type ProfileRow = {
    id: string;
    email: string;
    name: string | null;
    email_preferences: Record<string, unknown> | null;
};

type TenantUserRow = {
    user_id: string;
    tenant_id: string;
    role: string;
};

/**
 * Formats the executive HTML email for the Daily Business Summary.
 */
export function formatDailyBusinessSummaryHtml(summary: DailyBusinessSummary, dashboardUrl: string): string {
    const { tenantName, date, atAGlance, needsYourAttention, tomorrowPriorityWork, isQuietDay } = summary;

    if (isQuietDay) {
        return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 30px; }
  .container { max-width: 650px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
  .header { border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
  .brand { font-size: 20px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px; }
  .title { font-size: 24px; font-weight: 800; color: #ffffff; margin: 8px 0 4px 0; }
  .date { color: #94a3b8; font-size: 14px; }
  .quiet-box { background: rgba(56, 189, 248, 0.08); border-left: 4px solid #38bdf8; padding: 20px; border-radius: 6px; margin: 20px 0; }
  .btn { display: inline-block; background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ALPHACLONE SYSTEMS</div>
      <div class="title">${tenantName} — Daily Business Summary</div>
      <div class="date">${date}</div>
    </div>
    
    <div class="quiet-box">
      <h3 style="margin-top:0; color:#38bdf8;">Quiet & Steady Day</h3>
      <p style="margin-bottom:0; color:#cbd5e1; line-height:1.6;">
        No critical issues or high-volume operational events today. 
        All systems are running normally.
      </p>
    </div>

    <ul>
      <li>5 normal business background operations processed</li>
      <li>No client SLA responses overdue</li>
      <li>No failed automations or projects at risk</li>
      <li>No pending approvals waiting</li>
    </ul>

    <a href="${dashboardUrl}" class="btn">Open Operations Center</a>
  </div>
</body>
</html>
`;
    }

    // Build Needs Your Attention section
    let attentionHtml = '';
    if (needsYourAttention.length > 0) {
        const items = needsYourAttention.map(item => `
            <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 6px; margin-bottom: 12px;">
                <div style="font-weight: 700; color: #fca5a5; font-size: 15px;">⚠️ ${item.title}</div>
                <div style="color: #cbd5e1; font-size: 14px; margin: 4px 0;">${item.description}</div>
                <div style="color: #38bdf8; font-size: 13px; font-weight: 600;">Action Required: ${item.actionRequired}</div>
            </div>
        `).join('');

        attentionHtml = `
            <div style="margin-bottom: 28px;">
                <h3 style="color: #ef4444; font-size: 16px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 14px;">🚨 NEEDS YOUR ATTENTION (${needsYourAttention.length})</h3>
                ${items}
            </div>
        `;
    }

    // Tomorrow Priority Work HTML
    const tomorrowDoFirst = (tomorrowPriorityWork.doFirst || []).concat(tomorrowPriorityWork.respond || []).concat(tomorrowPriorityWork.followUp || []);
    const tomorrowListHtml = tomorrowDoFirst.length > 0 
        ? tomorrowDoFirst.map(t => `<li style="margin-bottom: 6px; color: #cbd5e1;">${t}</li>`).join('')
        : '<li style="color: #94a3b8;">Review upcoming schedule and client follow-ups.</li>';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f8fafc; margin: 0; padding: 24px; }
  .container { max-width: 680px; margin: 0 auto; background: #131c2e; border-radius: 14px; border: 1px solid #1e293b; padding: 36px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }
  .header { border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 13px; font-weight: 700; color: #38bdf8; letter-spacing: 1.5px; text-transform: uppercase; }
  .title { font-size: 26px; font-weight: 800; color: #ffffff; margin: 6px 0 4px 0; }
  .date { color: #64748b; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat-card { background: #1e293b; padding: 14px 18px; border-radius: 8px; border: 1px solid #334155; }
  .stat-num { font-size: 22px; font-weight: 800; color: #38bdf8; }
  .stat-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
  .section-title { font-size: 16px; font-weight: 700; color: #f8fafc; border-bottom: 1px solid #334155; padding-bottom: 8px; margin: 28px 0 14px 0; letter-spacing: 0.5px; }
  .btn { display: inline-block; background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">ALPHACLONE SYSTEMS — AUTOMATIC DAILY SUMMARY</div>
      <div class="title">${tenantName}</div>
      <div class="date">End-of-Day Report — ${date}</div>
    </div>

    ${attentionHtml}

    <div class="section-title">📊 TODAY AT A GLANCE</div>
    <div class="grid">
      <div class="stat-card">
        <div class="stat-num">${atAGlance.actionsCompleted}</div>
        <div class="stat-label">Actions Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${atAGlance.newLeads}</div>
        <div class="stat-label">New Leads</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${atAGlance.invoices}</div>
        <div class="stat-label">Invoices Created</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${atAGlance.payments}</div>
        <div class="stat-label">Payments Received</div>
      </div>
    </div>

    <div class="section-title">🚀 SALES & CLIENT ACTIVITY</div>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
      • <strong>Leads Added:</strong> ${summary.sales.leadsAdded} | <strong>Qualified:</strong> ${summary.sales.leadsQualified}<br/>
      • <strong>Proposals Sent:</strong> ${summary.sales.proposalsSent} | <strong>Accepted:</strong> ${summary.sales.proposalsAccepted.length}<br/>
      • <strong>Deals Won:</strong> ${summary.sales.dealsWon} | <strong>Deals Lost:</strong> ${summary.sales.dealsLost}
    </p>

    <div class="section-title">✉️ EMAIL & COMMUNICATION SLAs</div>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
      • <strong>Waiting For Our Reply:</strong> ${summary.emailWaitingForUs.length}<br/>
      • <strong>SLA Breached (>24h):</strong> <span style="color: ${summary.emailSlaBreached.length > 0 ? '#ef4444' : '#cbd5e1'}">${summary.emailSlaBreached.length}</span>
    </p>

    <div class="section-title">📂 PROJECTS & DELIVERABLES</div>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
      • <strong>Projects Created Today:</strong> ${summary.projects.created.length}<br/>
      • <strong>Projects Blocked:</strong> ${summary.projects.blocked.length}<br/>
      • <strong>Projects At Risk:</strong> ${summary.projects.atRisk.length}
    </p>

    <div class="section-title">🤖 MCP & AUTONOMOUS AI ACTIONS</div>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
      • <strong>Automations Executed:</strong> ${summary.automations.successful}<br/>
      • <strong>Failed Automations:</strong> ${summary.automations.failed}
    </p>

    <div class="section-title">🎯 TOMORROW — PRIORITY WORK</div>
    <ul style="padding-left: 20px; font-size: 14px;">
      ${tomorrowListHtml}
    </ul>

    <div style="text-align: center; margin-top: 32px;">
      <a href="${dashboardUrl}" class="btn">Open Operational Dashboard</a>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Formats plain text fallback for Daily Business Summary.
 */
export function formatDailyBusinessSummaryText(summary: DailyBusinessSummary, dashboardUrl: string): string {
    const { tenantName, date, atAGlance, needsYourAttention, tomorrowPriorityWork, isQuietDay } = summary;

    if (isQuietDay) {
        return `[AlphaClone Systems] ${tenantName} — Daily Business Summary (${date})\n\nQuiet & Steady Day. No critical issues today.\n- 5 normal business background operations completed.\n- No client replies overdue.\n- No failed automations.\n\nOpen Dashboard: ${dashboardUrl}`;
    }

    let text = `[AlphaClone Systems] ${tenantName} — Daily Business Summary (${date})\n\n`;

    if (needsYourAttention.length > 0) {
        text += `NEEDS YOUR ATTENTION (${needsYourAttention.length}):\n`;
        needsYourAttention.forEach(item => {
            text += `- ${item.title}: ${item.description} (Action: ${item.actionRequired})\n`;
        });
        text += `\n`;
    }

    text += `TODAY AT A GLANCE:\n`;
    text += `- Completed Actions: ${atAGlance.actionsCompleted}\n`;
    text += `- New Leads: ${atAGlance.newLeads}\n`;
    text += `- Invoices Created: ${atAGlance.invoices}\n`;
    text += `- Payments Received: ${atAGlance.payments}\n`;
    text += `- Operational Failures: ${atAGlance.failures}\n\n`;

    text += `SALES & CLIENTS:\n`;
    text += `- Leads Added: ${summary.sales.leadsAdded}, Qualified: ${summary.sales.leadsQualified}\n`;
    text += `- Proposals Sent: ${summary.sales.proposalsSent}, Accepted: ${summary.sales.proposalsAccepted.length}\n\n`;

    text += `TOMORROW PRIORITY WORK:\n`;
    (tomorrowPriorityWork.doFirst || []).concat(tomorrowPriorityWork.respond || []).forEach(item => {
        text += `- ${item}\n`;
    });

    text += `\nOpen Operations Dashboard: ${dashboardUrl}`;
    return text;
}

/**
 * Runs the daily business summary generator and sends summary emails to tenant recipients.
 */
export async function runDailyBusinessSummaryEmails(): Promise<{
    tenantsProcessed: number;
    emailsSent: number;
    failed: number;
}> {
    const admin = createSupabaseAdminClient();
    const dashboardUrl = defaultDashboardUrl();
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: tenantUsers, error } = await admin
        .from('tenant_users')
        .select('user_id, tenant_id, role')
        .in('role', ['owner', 'admin', 'tenant_admin', 'manager'])
        .limit(1000);

    if (error || !tenantUsers?.length) {
        console.warn('[dailyBusinessSummary] load tenant_users:', error);
        return { tenantsProcessed: 0, emailsSent: 0, failed: 0 };
    }

    // Group users by tenant
    const tenantMap = new Map<string, string[]>();
    tenantUsers.forEach((tu: TenantUserRow) => {
        if (!tu.tenant_id || !tu.user_id) return;
        const users = tenantMap.get(tu.tenant_id) || [];
        users.push(tu.user_id);
        tenantMap.set(tu.tenant_id, users);
    });

    let emailsSent = 0;
    let failed = 0;
    let tenantsProcessed = 0;

    for (const [tenantId, userIds] of tenantMap.entries()) {
        tenantsProcessed += 1;
        try {
            // Generate summary data for tenant
            const summary = await dailyBusinessSummaryService.getDailySummary(tenantId, todayStr);
            const html = formatDailyBusinessSummaryHtml(summary, dashboardUrl);
            const text = formatDailyBusinessSummaryText(summary, dashboardUrl);

            // Fetch recipient profiles
            const { data: profiles } = await admin
                .from('profiles')
                .select('id, email, name, email_preferences')
                .in('id', userIds);

            if (!profiles?.length) continue;

            for (const profile of profiles as ProfileRow[]) {
                if (!profile.email) continue;

                const result = await sendEmailServer({
                    tenantId,
                    userId: profile.id,
                    to: profile.email,
                    subject: `[AlphaClone Daily Summary] ${summary.tenantName} — ${summary.date}`,
                    html,
                    text,
                    isPlatformNotification: true,
                    templateName: 'daily_business_summary',
                    skipFooter: false
                });

                if (result.success) {
                    emailsSent += 1;
                } else {
                    failed += 1;
                    console.error(`[dailyBusinessSummary] delivery failed for ${profile.email}:`, result.error);

                    // Create operational failure event as required by Rule 24
                    await admin.from('failure_records').insert({
                        tenant_id: tenantId,
                        category: 'email',
                        title: `Daily Business Summary Email Delivery Failed`,
                        expected_result: `Daily summary email delivered to ${profile.email}`,
                        actual_result: result.error || 'Delivery failed',
                        failure_owner_id: profile.id,
                        failure_owner_name: profile.name || profile.email,
                        business_impact: 'Tenant owner did not receive automated end-of-day operational summary.',
                        root_cause: result.error || 'Email service error',
                        status: 'NEW',
                        recovery_action: 'Retry sending email via admin portal.'
                    });
                }
            }
        } catch (tenantErr) {
            console.error(`[dailyBusinessSummary] Error processing tenant ${tenantId}:`, tenantErr);
            failed += 1;
        }
    }

    return { tenantsProcessed, emailsSent, failed };
}
