import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import { evaluateProjectHealth } from '@/lib/projects/projectHealth';

function isDone(status: unknown): boolean {
  return ['completed', 'complete', 'done', 'closed', 'finished'].includes(String(status || '').trim().toLowerCase());
}

function isOpen(status: unknown): boolean {
  return !['resolved', 'closed', 'completed', 'done', 'cancelled', 'canceled'].includes(String(status || '').trim().toLowerCase());
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string; projectId: string }> }) {
  try {
    const { tenantId, projectId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();

    if (!(await isExecutionFeatureEnabled(admin, 'PROJECTS_V2', tenantId))) {
      return NextResponse.json({ error: 'Projects V2 is not enabled for this workspace' }, { status: 404 });
    }

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const nowIso = new Date().toISOString();
    const [tasksResult, milestonesResult, blockersResult, activityResult, relationshipsResult] = await Promise.all([
      admin
        .from('tasks')
        .select('id, title, status, due_date, parent_task_id, milestone_id, progress_percent, weight, owner_user_id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      admin
        .from('project_milestones')
        .select('id, name, description, status, target_date, due_date, progress_percent, order_index')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('order_index', { ascending: true }),
      admin
        .from('project_issues')
        .select('id, title, severity, priority, status, due_date')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .is('deleted_at', null),
      admin
        .from('project_activity')
        .select('id, action, target_type, target_id, source, correlation_id, created_at, new_value')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('project_relationships')
        .select('target_type, target_id, relationship_type, created_at')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId),
    ]);

    const tasks = tasksResult.data || [];
    const milestones = milestonesResult.data || [];
    const blockers = (blockersResult.data || []).filter((item: any) => isOpen(item.status));
    const overdueTasks = tasks.filter((task: any) => task.due_date && task.due_date < nowIso && !isDone(task.status));
    const overdueMilestones = milestones.filter((milestone: any) => {
      const due = milestone.target_date || milestone.due_date;
      return due && String(due) < nowIso && !isDone(milestone.status);
    });
    const completedTasks = tasks.filter((task: any) => isDone(task.status));

    let finance = {
      contractValue: Number(project.budget_total ?? project.approved_budget ?? project.budget ?? 0) || 0,
      invoiced: 0,
      paid: 0,
      outstanding: 0,
      currency: project.currency_code || 'USD',
    };

    const invoiceIds = (relationshipsResult.data || [])
      .filter((rel: any) => ['invoice', 'business_invoice'].includes(String(rel.target_type || '').toLowerCase()))
      .map((rel: any) => rel.target_id)
      .filter(Boolean);

    if (invoiceIds.length > 0) {
      const { data: invoices } = await admin
        .from('business_invoices')
        .select('id, total, amount_paid, balance_due, currency, status, due_date')
        .eq('tenant_id', tenantId)
        .in('id', invoiceIds);
      for (const invoice of invoices || []) {
        const total = Number((invoice as any).total || 0) || 0;
        const paid = Number((invoice as any).amount_paid || 0) || 0;
        const balance = Number((invoice as any).balance_due ?? Math.max(0, total - paid)) || 0;
        finance.invoiced += total;
        finance.paid += paid;
        finance.outstanding += balance;
        if ((invoice as any).currency) finance.currency = (invoice as any).currency;
      }
    }

    const health = evaluateProjectHealth({
      projectStatus: project.status,
      dueDate: project.target_date || project.due_date,
      openBlockers: blockers.length,
      overdueTasks: overdueTasks.length,
      overdueMilestones: overdueMilestones.length,
      outstandingAmount: finance.outstanding,
      paymentOverdue: false,
      completedTasks: completedTasks.length,
      totalTasks: tasks.length,
    });

    const weightedTotal = tasks.reduce((sum: number, task: any) => sum + Math.max(0, Number(task.weight || 1)), 0);
    const weightedDone = tasks.reduce((sum: number, task: any) => {
      const weight = Math.max(0, Number(task.weight || 1));
      const progress = Math.min(100, Math.max(0, Number(task.progress_percent ?? (isDone(task.status) ? 100 : 0))));
      return sum + weight * (progress / 100);
    }, 0);
    const calculatedProgress = weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 100) : Number(project.progress || 0);
    const nextMilestone = milestones.find((milestone: any) => !isDone(milestone.status)) || null;
    const nextTask = tasks.find((task: any) => !isDone(task.status)) || null;

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        clientId: project.client_id,
        dealId: project.deal_id,
        contractId: project.contract_id,
        ownerUserId: project.owner_user_id || project.owner_id,
        status: project.status,
        stage: project.current_stage,
        priority: project.priority,
        startDate: project.start_date,
        deadline: project.target_date || project.due_date,
        progress: calculatedProgress,
        health: health.status,
        healthReasons: health.reasons,
      },
      summary: {
        nextMilestone,
        nextAction: nextTask,
        taskCounts: {
          total: tasks.length,
          completed: completedTasks.length,
          overdue: overdueTasks.length,
        },
        milestoneCounts: {
          total: milestones.length,
          overdue: overdueMilestones.length,
        },
        blockers: blockers.slice(0, 10),
        finance,
      },
      relationships: relationshipsResult.data || [],
      activity: activityResult.data || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Project summary could not be loaded', req);
  }
}
