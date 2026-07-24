/**
 * Durable timers — no setTimeout for business delays.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionTask } from './transitionService';
import { insertOutboxEvent } from './outboxService';

export async function createTimer(params: {
  tenantId: string;
  taskId?: string | null;
  runId?: string | null;
  executeAt: string;
  timerType?: string;
  tenantTimezone?: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('agent_timers')
    .insert({
      tenant_id: params.tenantId,
      task_id: params.taskId || null,
      run_id: params.runId || null,
      execute_at: params.executeAt,
      timer_type: params.timerType || 'delay',
      tenant_timezone: params.tenantTimezone || 'UTC',
      payload: params.payload || {},
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function fireDueTimers(limit = 50): Promise<{ fired: number }> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const worker = `timer-${process.pid}`;

  const { data: due } = await admin
    .from('agent_timers')
    .select('*')
    .eq('status', 'pending')
    .lte('execute_at', now)
    .order('execute_at', { ascending: true })
    .limit(limit);

  let fired = 0;
  for (const timer of due || []) {
    const claim = await admin
      .from('agent_timers')
      .update({
        status: 'claimed',
        claimed_by: worker,
        claim_expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq('id', timer.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claim.data) continue;

    try {
      if (timer.task_id) {
        const { data: task } = await admin
          .from('agent_tasks')
          .select('id, status, version, run_id, correlation_id, tenant_id')
          .eq('id', timer.task_id)
          .maybeSingle();

        if (task && ['RETRY_SCHEDULED', 'WAITING_FOR_EVENT', 'PAUSED', 'WAITING_FOR_APPROVAL'].includes(task.status)) {
          await transitionTask({
            tenantId: task.tenant_id,
            taskId: task.id,
            to: 'READY',
            trigger: 'timer_fired',
            actorType: 'timer',
            actorId: worker,
            expectedVersion: task.version,
            patch: { scheduled_at: null },
          });
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
        }
      }

      await admin
        .from('agent_timers')
        .update({ status: 'fired', fired_at: new Date().toISOString() })
        .eq('id', timer.id);
      fired += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from('agent_timers')
        .update({ status: 'failed', payload: { ...(timer.payload || {}), error: message } })
        .eq('id', timer.id);
    }
  }

  return { fired };
}
