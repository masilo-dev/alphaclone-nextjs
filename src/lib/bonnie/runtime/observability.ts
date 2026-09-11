/**
 * Runtime observability metrics (tenant-safe, no sensitive bodies).
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function getRuntimeMetrics(tenantId?: string) {
  const admin = createSupabaseAdminClient();

  async function count(table: string, filters?: Record<string, string>) {
    let q = admin.from(table).select('id', { count: 'exact', head: true });
    if (tenantId) q = q.eq('tenant_id', tenantId);
    if (filters) {
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    }
    const { count } = await q;
    return count || 0;
  }

  const [
    tasksByReady,
    tasksRunning,
    tasksWaitingEvent,
    tasksWaitingApproval,
    tasksFailed,
    tasksUncertain,
    expiredLeasesApprox,
    pendingOutbox,
    pendingInbox,
    dueTimers,
    openInterventions,
  ] = await Promise.all([
    count('agent_tasks', { status: 'READY' }),
    count('agent_tasks', { status: 'RUNNING' }),
    count('agent_tasks', { status: 'WAITING_FOR_EVENT' }),
    count('agent_tasks', { status: 'WAITING_FOR_APPROVAL' }),
    count('agent_tasks', { status: 'FAILED' }),
    count('agent_tasks', { status: 'EXECUTION_UNCERTAIN' }),
    count('agent_tasks', { status: 'CLAIMED' }),
    count('agent_event_outbox', { delivery_status: 'pending' }),
    count('agent_event_inbox', { processing_status: 'pending' }),
    count('agent_timers', { status: 'pending' }),
    count('agent_interventions', { status: 'open' }),
  ]);

  return {
    tasks: {
      ready: tasksByReady,
      running: tasksRunning,
      waitingEvent: tasksWaitingEvent,
      waitingApproval: tasksWaitingApproval,
      failed: tasksFailed,
      uncertain: tasksUncertain,
      claimed: expiredLeasesApprox,
    },
    pendingOutbox,
    pendingInbox,
    dueTimers,
    openInterventions,
    generatedAt: new Date().toISOString(),
  };
}
