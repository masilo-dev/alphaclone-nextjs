/**
 * Scheduler — promote DRAFT tasks whose dependencies are satisfied to READY + outbox.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionTask } from './transitionService';
import { insertOutboxEvent } from './outboxService';

const SUCCESS_STATUSES = new Set(['COMPLETED', 'SKIPPED']);

export async function scheduleReadyTasks(params: {
  tenantId?: string;
  runId?: string;
  limit?: number;
}): Promise<{ promoted: number }> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from('agent_tasks')
    .select('id, tenant_id, run_id, status, version, correlation_id, scheduled_at')
    .in('status', ['DRAFT', 'WAITING_FOR_DEPENDENCY', 'RETRY_SCHEDULED'])
    .order('priority', { ascending: true })
    .limit(params.limit || 80);

  if (params.tenantId) q = q.eq('tenant_id', params.tenantId);
  if (params.runId) q = q.eq('run_id', params.runId);

  const { data: candidates } = await q;
  let promoted = 0;

  for (const task of candidates || []) {
    if (task.scheduled_at && new Date(task.scheduled_at).getTime() > Date.now()) {
      continue;
    }

    // Cancellation gate
    const { data: run } = await admin
      .from('agent_runs')
      .select('status')
      .eq('id', task.run_id)
      .maybeSingle();
    if (run?.status === 'cancellation_requested' || run?.status === 'cancelled') {
      await transitionTask({
        tenantId: task.tenant_id,
        taskId: task.id,
        to: 'CANCELLED',
        trigger: 'run_cancelled',
        expectedVersion: task.version,
      });
      continue;
    }

    const { data: deps } = await admin
      .from('agent_task_dependencies')
      .select('depends_on_task_id, dependency_type')
      .eq('task_id', task.id);

    if (deps?.length) {
      const depIds = deps.map((d) => d.depends_on_task_id);
      const { data: depTasks } = await admin
        .from('agent_tasks')
        .select('id, status')
        .in('id', depIds);

      const byId = new Map((depTasks || []).map((t) => [t.id, t.status]));
      let ok = true;
      const anyTypes = deps.filter((d) => d.dependency_type === 'any_completed');
      const allTypes = deps.filter((d) => d.dependency_type !== 'any_completed');

      if (anyTypes.length) {
        ok = anyTypes.some((d) => SUCCESS_STATUSES.has(String(byId.get(d.depends_on_task_id))));
      }
      for (const d of allTypes) {
        const st = String(byId.get(d.depends_on_task_id) || '');
        if (d.dependency_type === 'succeeded' || d.dependency_type === 'finish_to_start' || d.dependency_type === 'all_completed') {
          if (!SUCCESS_STATUSES.has(st)) ok = false;
        } else if (!SUCCESS_STATUSES.has(st) && st !== 'COMPLETED') {
          // default strict
          if (!SUCCESS_STATUSES.has(st)) ok = false;
        }
      }
      if (!ok) {
        if (task.status === 'DRAFT') {
          await transitionTask({
            tenantId: task.tenant_id,
            taskId: task.id,
            to: 'WAITING_FOR_DEPENDENCY',
            trigger: 'deps_unmet',
            expectedVersion: task.version,
          });
        }
        continue;
      }
    }

    const result = await transitionTask({
      tenantId: task.tenant_id,
      taskId: task.id,
      to: 'READY',
      trigger: 'scheduler',
      actorType: 'scheduler',
      actorId: 'scheduleReadyTasks',
      expectedVersion: task.version,
    });
    if (!result.ok) continue;

    await insertOutboxEvent({
      tenantId: task.tenant_id,
      eventType: 'task.ready',
      payload: {
        task_id: task.id,
        run_id: task.run_id,
        tenant_id: task.tenant_id,
        correlation_id: task.correlation_id,
      },
      correlationId: task.correlation_id,
    });
    promoted += 1;
  }

  return { promoted };
}
