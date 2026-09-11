import type { SupabaseClient } from '@supabase/supabase-js';

export type ProjectAttentionReason =
  | 'overdue_task'
  | 'blocked_task'
  | 'missing_approval'
  | 'unpaid_invoice'
  | 'overdue_milestone'
  | 'approaching_deadline';

export type ProjectNextAction = {
  type: ProjectAttentionReason | 'continue_work';
  priority: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  entityId?: string;
  dueDate?: string | null;
};

export type ProjectIntelligence = {
  project: Record<string, unknown>;
  overdueTasks: Record<string, unknown>[];
  blockedTasks: Record<string, unknown>[];
  missingApprovals: Record<string, unknown>[];
  unpaidInvoices: Record<string, unknown>[];
  overdueMilestones: Record<string, unknown>[];
  nextActions: ProjectNextAction[];
  counts: {
    overdueTasks: number;
    blockedTasks: number;
    missingApprovals: number;
    unpaidInvoices: number;
    overdueMilestones: number;
  };
};

function isCompletedStatus(value: unknown): boolean {
  return ['completed', 'complete', 'done', 'closed', 'approved', 'paid'].includes(
    String(value || '').trim().toLowerCase(),
  );
}

function isOpenInvoiceStatus(value: unknown): boolean {
  return !['paid', 'void', 'cancelled', 'canceled', 'refunded'].includes(
    String(value || '').trim().toLowerCase(),
  );
}

function dateIsPast(value: unknown, nowMs: number): boolean {
  if (!value) return false;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) && parsed < nowMs;
}

export function deriveProjectNextActions(input: {
  overdueTasks: any[];
  blockedTasks: any[];
  missingApprovals: any[];
  unpaidInvoices: any[];
  overdueMilestones: any[];
}): ProjectNextAction[] {
  const actions: ProjectNextAction[] = [];

  for (const task of input.blockedTasks.slice(0, 3)) {
    actions.push({
      type: 'blocked_task',
      priority: 'critical',
      label: `Unblock task: ${task.title || task.id}`,
      entityId: task.id,
      dueDate: task.due_date || null,
    });
  }
  for (const approval of input.missingApprovals.slice(0, 3)) {
    actions.push({
      type: 'missing_approval',
      priority: 'high',
      label: `Obtain approval: ${approval.title || approval.name || approval.id}`,
      entityId: approval.id,
      dueDate: approval.expires_at || approval.due_date || null,
    });
  }
  for (const invoice of input.unpaidInvoices.slice(0, 3)) {
    actions.push({
      type: 'unpaid_invoice',
      priority: dateIsPast(invoice.due_date, Date.now()) ? 'critical' : 'high',
      label: `Follow up unpaid invoice: ${invoice.invoice_number || invoice.id}`,
      entityId: invoice.id,
      dueDate: invoice.due_date || null,
    });
  }
  for (const task of input.overdueTasks.slice(0, 3)) {
    actions.push({
      type: 'overdue_task',
      priority: 'high',
      label: `Complete overdue task: ${task.title || task.id}`,
      entityId: task.id,
      dueDate: task.due_date || null,
    });
  }
  for (const milestone of input.overdueMilestones.slice(0, 2)) {
    actions.push({
      type: 'overdue_milestone',
      priority: 'high',
      label: `Recover overdue milestone: ${milestone.name || milestone.title || milestone.id}`,
      entityId: milestone.id,
      dueDate: milestone.due_date || milestone.target_date || null,
    });
  }

  if (!actions.length) {
    actions.push({ type: 'continue_work', priority: 'low', label: 'Continue planned project work.' });
  }

  const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return actions.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 8);
}

export async function loadProjectIntelligence(
  supabase: SupabaseClient,
  tenantId: string,
  projectId: string,
): Promise<ProjectIntelligence> {
  const now = new Date();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id,name,status,health_status,health_reasons,priority,target_date,due_date,client_id,contract_id,deal_id,progress,metadata')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error('project_not_found');

  const [tasksResult, dependenciesResult, milestonesResult, invoicesResult, deliverablesResult, approvalsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,title,status,priority,due_date,requires_approval,progress_percent,milestone_id,parent_task_id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('task_dependencies')
      .select('id,task_id,depends_on_task_id,dependency_type')
      .eq('tenant_id', tenantId),
    supabase
      .from('project_milestones')
      .select('id,name,status,due_date,target_date,progress_percent,order_index')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('business_invoices')
      .select('id,invoice_number,status,lifecycle_status,total,amount_paid,balance_due,due_date,currency,contract_id,project_id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId),
    supabase
      .from('project_deliverables')
      .select('id,name,status,due_date,approver_user_id,accepted_at,milestone_id')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('project_client_approvals')
      .select('id,title,status,approval_type,task_id,milestone_id,deliverable_id,document_id,expires_at,requested_at,requested_from_name,requested_from_email,version_label')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .in('status', ['pending', 'viewed']),
  ]);

  for (const result of [tasksResult, dependenciesResult, milestonesResult, invoicesResult, deliverablesResult, approvalsResult]) {
    if (result.error) throw result.error;
  }

  const tasks = tasksResult.data || [];
  const taskById = new Map(tasks.map((task: any) => [task.id, task]));
  const dependencies = dependenciesResult.data || [];
  const milestones = milestonesResult.data || [];
  const invoices = invoicesResult.data || [];
  const deliverables = deliverablesResult.data || [];
  const persistedApprovals = (approvalsResult.data || []).map((approval: any) => ({
    ...approval,
    approval_source: 'client_approval',
  }));

  const overdueTasks = tasks.filter(
    (task: any) => !isCompletedStatus(task.status) && dateIsPast(task.due_date, now.getTime()),
  );

  const blockedTaskIds = new Set<string>();
  for (const edge of dependencies as any[]) {
    const task = taskById.get(edge.task_id) as any;
    const dependency = taskById.get(edge.depends_on_task_id) as any;
    if (task && dependency && !isCompletedStatus(task.status) && !isCompletedStatus(dependency.status)) {
      blockedTaskIds.add(task.id);
    }
  }
  const blockedTasks = tasks.filter((task: any) => blockedTaskIds.has(task.id));

  const persistedTaskIds = new Set(persistedApprovals.map((approval: any) => approval.task_id).filter(Boolean));
  const persistedDeliverableIds = new Set(persistedApprovals.map((approval: any) => approval.deliverable_id).filter(Boolean));
  const taskApprovals = tasks
    .filter((task: any) => task.requires_approval && !isCompletedStatus(task.status) && !persistedTaskIds.has(task.id))
    .map((task: any) => ({ ...task, approval_source: 'task_requirement' }));
  const deliverableApprovals = deliverables
    .filter((item: any) => item.approver_user_id && !item.accepted_at && !isCompletedStatus(item.status) && !persistedDeliverableIds.has(item.id))
    .map((item: any) => ({ ...item, approval_source: 'deliverable_requirement' }));
  const missingApprovals = [...persistedApprovals, ...taskApprovals, ...deliverableApprovals];

  const unpaidInvoices = invoices.filter((invoice: any) => {
    const balance = Number(invoice.balance_due ?? Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
    return isOpenInvoiceStatus(invoice.lifecycle_status || invoice.status) && balance > 0;
  });

  const overdueMilestones = milestones.filter(
    (milestone: any) =>
      !isCompletedStatus(milestone.status) &&
      (dateIsPast(milestone.due_date, now.getTime()) || dateIsPast(milestone.target_date, now.getTime())),
  );

  const nextActions = deriveProjectNextActions({
    overdueTasks,
    blockedTasks,
    missingApprovals,
    unpaidInvoices,
    overdueMilestones,
  });

  return {
    project,
    overdueTasks,
    blockedTasks,
    missingApprovals,
    unpaidInvoices,
    overdueMilestones,
    nextActions,
    counts: {
      overdueTasks: overdueTasks.length,
      blockedTasks: blockedTasks.length,
      missingApprovals: missingApprovals.length,
      unpaidInvoices: unpaidInvoices.length,
      overdueMilestones: overdueMilestones.length,
    },
  };
}

export async function loadWorkspaceProjectBrief(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 50,
) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id,name,status,health_status,priority,target_date,due_date,progress')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw error;

  const activeProjects = (projects || []).filter((project: any) => !isCompletedStatus(project.status));
  const intelligence = [] as ProjectIntelligence[];
  for (const project of activeProjects.slice(0, 25)) {
    intelligence.push(await loadProjectIntelligence(supabase, tenantId, project.id));
  }

  const needsAttention = intelligence.filter((item) =>
    Object.values(item.counts).some((count) => count > 0),
  );
  const highestRisk = needsAttention
    .slice()
    .sort((a, b) => {
      const score = (x: ProjectIntelligence) =>
        x.counts.blockedTasks * 5 +
        x.counts.unpaidInvoices * 4 +
        x.counts.missingApprovals * 3 +
        x.counts.overdueTasks * 2 +
        x.counts.overdueMilestones * 2;
      return score(b) - score(a);
    })[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    activeProjects: activeProjects.length,
    projectsNeedingAttention: needsAttention.length,
    overdueTasks: intelligence.reduce((sum, item) => sum + item.counts.overdueTasks, 0),
    blockedProjects: intelligence.filter((item) => item.counts.blockedTasks > 0).length,
    waitingOnApproval: intelligence.filter((item) => item.counts.missingApprovals > 0).length,
    waitingOnPayment: intelligence.filter((item) => item.counts.unpaidInvoices > 0).length,
    highestRisk: highestRisk
      ? {
          project: highestRisk.project,
          counts: highestRisk.counts,
          nextActions: highestRisk.nextActions,
        }
      : null,
    projects: intelligence.map((item) => ({
      project: item.project,
      counts: item.counts,
      nextActions: item.nextActions,
    })),
  };
}
