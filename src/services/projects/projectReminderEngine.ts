import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { commitmentEngine } from '../intelligence/commitmentEngine';

export interface ProjectAlert {
  projectId: string;
  projectName: string;
  clientName?: string;
  alertType: 'deadline' | 'overdue_task' | 'pending_approval' | 'unanswered_email' | 'milestone_risk' | 'missing_doc' | 'inactivity' | 'blocker' | 'overdue_commitment';
  severity: 'info' | 'warning' | 'critical';
  headline: string;
  detailedContext: string;
  requiredAction: string;
  businessImpact: string;
  projectLink: string;
}

export interface OwnerMorningBrief {
  ownerId: string;
  tenantId: string;
  briefDate: string;
  summaryText: string;
  projectAlerts: ProjectAlert[];
}

export class ProjectReminderEngine {
  /**
   * Evaluates a single project and generates actionable alerts with full context
   */
  async evaluateProject(tenantId: string, projectId: string): Promise<ProjectAlert[]> {
    const admin = createSupabaseAdminClient();
    const alerts: ProjectAlert[] = [];
    const now = new Date();

    // Fetch project details
    const { data: project } = await admin
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .maybeSingle();

    if (!project) return [];

    // Fetch client details if linked
    let clientName = 'Client';
    if (project.client_id) {
      const { data: client } = await admin
        .from('business_clients')
        .select('name, company')
        .eq('id', project.client_id)
        .maybeSingle();
      if (client) clientName = client.company || client.name || 'Client';
    }

    // 1. Deadline check
    if (project.due_date || project.target_date) {
      const target = new Date(project.due_date || project.target_date);
      const hoursDiff = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 0 && hoursDiff <= 36) {
        alerts.push({
          projectId,
          projectName: project.name,
          clientName,
          alertType: 'deadline',
          severity: 'warning',
          headline: `${project.name} has a milestone/deadline due soon.`,
          detailedContext: `Target deadline is ${target.toLocaleDateString()} at ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${clientName}. Current progress is ${project.progress || 0}%.`,
          requiredAction: 'Review remaining deliverables and confirm completion with team.',
          businessImpact: 'Unmet deadlines risk client SLA breach and milestone delay.',
          projectLink: `/dashboard/business/projects/${projectId}`,
        });
      } else if (hoursDiff < 0 && project.status !== 'Completed') {
        alerts.push({
          projectId,
          projectName: project.name,
          clientName,
          alertType: 'deadline',
          severity: 'critical',
          headline: `${project.name} is OVERDUE by ${Math.abs(Math.floor(hoursDiff / 24))} days.`,
          detailedContext: `Target date was ${target.toLocaleDateString()}. Project status is still '${project.status}' for ${clientName}.`,
          requiredAction: 'Re-align project timeline with client or complete final deliverables immediately.',
          businessImpact: 'Overdue delivery impacts client satisfaction and final invoice collection.',
          projectLink: `/dashboard/business/projects/${projectId}`,
        });
      }
    }

    // 2. Overdue & Blocking Tasks
    const { data: tasks } = await admin
      .from('tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .neq('status', 'completed');

    if (tasks && tasks.length > 0) {
      const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
      const blockingTasks = tasks.filter(t => t.requires_approval || t.status === 'blocked');

      if (overdueTasks.length > 0) {
        const topTask = overdueTasks[0];
        alerts.push({
          projectId,
          projectName: project.name,
          clientName,
          alertType: 'overdue_task',
          severity: overdueTasks.length > 2 ? 'critical' : 'warning',
          headline: `${overdueTasks.length} incomplete tasks overdue in ${project.name}.`,
          detailedContext: `Key task '${topTask.title}' was due on ${new Date(topTask.due_date).toLocaleDateString()}. ${tasks.length} total active tasks remain.`,
          requiredAction: `Complete '${topTask.title}' or assign resources to clear the bottleneck.`,
          businessImpact: 'Development progress is blocked by incomplete tasks.',
          projectLink: `/dashboard/business/projects/${projectId}`,
        });
      }

      if (blockingTasks.length > 0) {
        alerts.push({
          projectId,
          projectName: project.name,
          clientName,
          alertType: 'blocker',
          severity: 'warning',
          headline: `Blocker detected in ${project.name}: ${blockingTasks.length} task(s) awaiting approval or blocked.`,
          detailedContext: `Task '${blockingTasks[0].title}' is currently blocked or requires explicit sign-off.`,
          requiredAction: 'Provide required sign-off or resolve technical dependency.',
          businessImpact: 'Downstream tasks cannot commence until blocker is cleared.',
          projectLink: `/dashboard/business/projects/${projectId}`,
        });
      }
    }

    // 3. Unanswered Client Communications (>12h / >19h)
    if (project.last_client_contact_at) {
      const lastContact = new Date(project.last_client_contact_at);
      const hoursWaiting = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);

      if (hoursWaiting >= 18) {
        alerts.push({
          projectId,
          projectName: project.name,
          clientName,
          alertType: 'unanswered_email',
          severity: 'critical',
          headline: `${clientName} has been waiting ${Math.floor(hoursWaiting)} hours for a response on ${project.name}.`,
          detailedContext: `Last client email was received at ${lastContact.toLocaleString()}. The next milestone relies on active response.`,
          requiredAction: 'Reply immediately to client email or send progress status update.',
          businessImpact: 'SLA risk and potential client relationship escalation.',
          projectLink: `/dashboard/business/projects/${projectId}`,
        });
      }
    }

    // 4. Overdue Commitments
    const projectCommitments = await commitmentEngine.getProjectCommitments(tenantId, projectId);
    const overdueCommitments = projectCommitments.filter(c => c.status === 'pending' && c.due_date && new Date(c.due_date) < now);

    if (overdueCommitments.length > 0) {
      const topCommitment = overdueCommitments[0];
      alerts.push({
        projectId,
        projectName: project.name,
        clientName,
        alertType: 'overdue_commitment',
        severity: 'critical',
        headline: `Overdue commitment for ${clientName} in ${project.name}.`,
        detailedContext: `Commitment '${topCommitment.commitment}' made by ${topCommitment.maker_type === 'our_team' ? 'our team' : 'client'} was due on ${new Date(topCommitment.due_date!).toLocaleDateString()}.`,
        requiredAction: `Follow up or fulfill promise: "${topCommitment.commitment}"`,
        businessImpact: 'Unfulfilled promises erode client trust and delay sign-offs.',
        projectLink: `/dashboard/business/projects/${projectId}`,
      });
    }

    return alerts;
  }

  /**
   * Generates a consolidated Morning Brief for a Project Owner
   */
  async generateOwnerMorningBrief(tenantId: string, ownerUserId: string): Promise<OwnerMorningBrief> {
    const admin = createSupabaseAdminClient();
    const todayStr = new Date().toISOString().slice(0, 10);

    // Get owner's active projects
    const { data: projects } = await admin
      .from('projects')
      .select('id, name, status')
      .eq('tenant_id', tenantId)
      .or(`owner_id.eq.${ownerUserId},owner_user_id.eq.${ownerUserId}`)
      .neq('status', 'Completed');

    const allAlerts: ProjectAlert[] = [];
    if (projects) {
      for (const p of projects) {
        const pAlerts = await this.evaluateProject(tenantId, p.id);
        allAlerts.push(...pAlerts);
      }
    }

    // Build consolidated summary text
    let summaryText = `Project Owner Brief — ${todayStr}\n\n`;
    if (allAlerts.length === 0) {
      summaryText += `All ${projects?.length || 0} active projects are ON TRACK. No urgent blockers or overdue items requiring attention.`;
    } else {
      summaryText += `You have ${allAlerts.length} actionable item(s) across your active projects:\n\n`;
      allAlerts.forEach((a, i) => {
        summaryText += `${i + 1}. **${a.projectName}** (${a.clientName}): ${a.headline}\n   → Action: ${a.requiredAction}\n\n`;
      });
    }

    return {
      ownerId: ownerUserId,
      tenantId,
      briefDate: todayStr,
      summaryText,
      projectAlerts: allAlerts,
    };
  }

  /**
   * Generates a weekly operational report for the Project Owner
   */
  async generateOwnerWeeklySummary(tenantId: string, ownerUserId: string): Promise<string> {
    const admin = createSupabaseAdminClient();
    const { data: projects } = await admin
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`owner_id.eq.${ownerUserId},owner_user_id.eq.${ownerUserId}`);

    const active = (projects || []).filter(p => p.status !== 'Completed');
    const completed = (projects || []).filter(p => p.status === 'Completed');

    return `# Weekly Project Operational Report
- Active Projects: ${active.length}
- Completed Projects: ${completed.length}
- Average Project Health: ${active.length > 0 ? 'Good' : 'N/A'}
- Action Items: ${active.map(p => p.name).join(', ') || 'None'}`;
  }
}

export const projectReminderEngine = new ProjectReminderEngine();
