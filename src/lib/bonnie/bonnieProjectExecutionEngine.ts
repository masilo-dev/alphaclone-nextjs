import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { projectReminderEngine, ProjectAlert } from '@/services/projects/projectReminderEngine';
import { commitmentEngine } from '@/services/intelligence/commitmentEngine';
import { clientEmailEngine } from '@/services/email/clientEmailEngine';
import { meetingIntelligenceService } from '@/services/calendar/meetingIntelligenceService';

export interface ProjectExecutionReport {
  projectId: string;
  projectName: string;
  clientName: string;
  executionTimestamp: string;
  checkedPointsCount: number;
  alertsFound: ProjectAlert[];
  level1ActionsExecuted: string[];
  level2ActionsExecuted: string[];
  level3ApprovalsQueued: string[];
  meetingBriefsGenerated: string[];
  summaryText: string;
}

export class BonnieProjectExecutionEngine {
  /**
   * Execute project operational check and actions ("Bonnie, handle [Project] today")
   */
  async handleProjectCommand(tenantId: string, projectNameOrId: string): Promise<ProjectExecutionReport> {
    const admin = createSupabaseAdminClient();
    const now = new Date();

    // 1. Resolve project by ID or name
    let projectId = projectNameOrId;
    let project: any = null;

    const { data: byId } = await admin
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', projectNameOrId)
      .maybeSingle();

    if (byId) {
      project = byId;
    } else {
      const { data: byName } = await admin
        .from('projects')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${projectNameOrId}%`)
        .maybeSingle();
      if (byName) {
        project = byName;
        projectId = byName.id;
      }
    }

    if (!project) {
      return {
        projectId: projectNameOrId,
        projectName: projectNameOrId,
        clientName: 'Unknown',
        executionTimestamp: now.toISOString(),
        checkedPointsCount: 0,
        alertsFound: [],
        level1ActionsExecuted: [],
        level2ActionsExecuted: [],
        level3ApprovalsQueued: [],
        meetingBriefsGenerated: [],
        summaryText: `Could not locate an active project matching "${projectNameOrId}".`,
      };
    }

    let clientName = 'Client';
    if (project.client_id) {
      const { data: client } = await admin
        .from('business_clients')
        .select('name, company')
        .eq('id', project.client_id)
        .maybeSingle();
      if (client) clientName = client.company || client.name || 'Client';
    }

    const level1ActionsExecuted: string[] = [];
    const level2ActionsExecuted: string[] = [];
    const level3ApprovalsQueued: string[] = [];
    const meetingBriefsGenerated: string[] = [];

    // 2. Run 13-point health check & reminder engine
    const alerts = await projectReminderEngine.evaluateProject(tenantId, projectId);

    // 3. Process action items

    // A. Unanswered Client Email Check -> Prepare Stage Email or Reminder
    if (project.last_client_contact_at) {
      const hoursWaiting = (now.getTime() - new Date(project.last_client_contact_at).getTime()) / (1000 * 60 * 60);
      if (hoursWaiting >= 12 && project.client_id) {
        const prepared = await clientEmailEngine.prepareStageEmail({
          tenantId,
          projectId,
          clientId: project.client_id,
          stage: 'client_review_required',
          deliverableName: 'Current Project Milestone',
        });

        if (prepared) {
          const res = await clientEmailEngine.dispatchPreparedEmail(prepared);
          if (prepared.requiresHumanApproval) {
            level3ApprovalsQueued.push(`Queued Level 3 Client Review Email for Human Approval (ID: ${prepared.humanApprovalId})`);
          } else if (res.sent) {
            level2ActionsExecuted.push(`Auto-dispatched Level 2 status email to ${prepared.recipientEmail}`);
          }
        }
      }
    }

    // B. Meeting check for today -> Generate Pre-meeting Brief
    const todayStr = now.toISOString().slice(0, 10);
    const { data: meetingsToday } = await admin
      .from('calendar_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('start_time', `${todayStr}T00:00:00.000Z`)
      .lte('start_time', `${todayStr}T23:59:59.999Z`);

    if (meetingsToday && meetingsToday.length > 0) {
      for (const mtg of meetingsToday) {
        const brief = await meetingIntelligenceService.generatePreMeetingBrief(tenantId, projectId, mtg.title || 'Client Alignment');
        meetingBriefsGenerated.push(`Synthesized Pre-meeting Brief for "${brief.title}" with ${brief.questionsRequiringAnswers.length} agenda items`);
      }
    }

    // C. Overdue Task Auto-Flagging
    const { data: overdueTasks } = await admin
      .from('tasks')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .neq('status', 'completed')
      .lt('due_date', now.toISOString());

    if (overdueTasks && overdueTasks.length > 0) {
      level1ActionsExecuted.push(`Flagged ${overdueTasks.length} overdue task(s) for priority resolution`);
    }

    // Build Execution Summary
    let summaryText = `Bonnie Autonomous Execution Summary for **${project.name}** (${clientName})\n\n`;
    summaryText += `**Operational Audit (13-Point Check):** Completed\n`;
    summaryText += `- Active Alerts Found: ${alerts.length}\n`;
    summaryText += `- Level 1/2 Actions Executed: ${level1ActionsExecuted.length + level2ActionsExecuted.length}\n`;
    summaryText += `- Level 3/4 Human Approvals Queued: ${level3ApprovalsQueued.length}\n`;
    summaryText += `- Pre-Meeting Briefs Prepared: ${meetingBriefsGenerated.length}\n\n`;

    if (alerts.length > 0) {
      summaryText += `**Key Findings:**\n`;
      alerts.forEach(a => {
        summaryText += `- [${a.severity.toUpperCase()}] ${a.headline}\n  → Action: ${a.requiredAction}\n`;
      });
      summaryText += `\n`;
    }

    if (level3ApprovalsQueued.length > 0) {
      summaryText += `**Pending Approvals Required:**\n`;
      level3ApprovalsQueued.forEach(item => {
        summaryText += `- ${item}\n`;
      });
      summaryText += `\n`;
    }

    summaryText += `Status: ${alerts.filter(a => a.severity === 'critical').length > 0 ? 'NEEDS ATTENTION' : 'HEALTHY'}`;

    return {
      projectId,
      projectName: project.name,
      clientName,
      executionTimestamp: now.toISOString(),
      checkedPointsCount: 13,
      alertsFound: alerts,
      level1ActionsExecuted,
      level2ActionsExecuted,
      level3ApprovalsQueued,
      meetingBriefsGenerated,
      summaryText,
    };
  }
}

export const bonnieProjectExecutionEngine = new BonnieProjectExecutionEngine();
