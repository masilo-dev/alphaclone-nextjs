/**
 * Reconciliation suite — safe to run repeatedly.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { reclaimExpiredLeases } from '../leaseService';
import { publishOutboxBatch } from '../outboxService';
import { processPendingInbox } from '../inboxService';
import { fireDueTimers } from '../timerService';
import { reconcileExpiredApprovals } from '../approvalDurabilityService';
import { scheduleReadyTasks } from '../schedulerService';
import { insertOutboxEvent } from '../outboxService';
import { transitionTask } from '../transitionService';
import { openIntervention } from '../interventionService';
import { reconcileAllTenantsExecutionReceipts } from '@/lib/mcp/executionAssurance';
import { runChaseScanForTenant } from '@/lib/chaser/chaseDetector';
import { executeDueChasesAllTenants } from '@/lib/chaser/chaseExecutorService';
import { isChaserGloballyEnabled } from '@/lib/chaser/chaseConfig';

async function logRepair(reconciler: string, repaired: number, details: Record<string, unknown>, tenantId?: string) {
  const admin = createSupabaseAdminClient();
  await admin.from('agent_reconciliation_logs').insert({
    tenant_id: tenantId || null,
    reconciler,
    repaired_count: repaired,
    details,
  });
}

export async function reconcileReadyWithoutOutbox(limit = 40) {
  const admin = createSupabaseAdminClient();
  const { data: ready } = await admin
    .from('agent_tasks')
    .select('id, tenant_id, run_id, correlation_id, updated_at')
    .eq('status', 'READY')
    .lt('updated_at', new Date(Date.now() - 60_000).toISOString())
    .limit(limit);

  let repaired = 0;
  for (const task of ready || []) {
    const since = task.updated_at;
    const { count } = await admin
      .from('agent_event_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', task.tenant_id)
      .eq('event_type', 'task.ready')
      .gte('created_at', since)
      .contains('payload', { task_id: task.id });

    // If contains filter unsupported, always insert repair outbox (idempotent claim prevents dup exec)
    if ((count || 0) === 0) {
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
      repaired += 1;
    }
  }
  await logRepair('ready_without_outbox', repaired, { limit });
  return { repaired };
}

export async function reconcileUncertainExecutions(limit = 20) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('agent_tasks')
    .select('id, tenant_id, run_id, idempotency_key, version, title')
    .eq('status', 'EXECUTION_UNCERTAIN')
    .limit(limit);

  let repaired = 0;
  for (const task of data || []) {
    if (task.idempotency_key) {
      const { data: idem } = await admin
        .from('agent_idempotency_keys')
        .select('*')
        .eq('tenant_id', task.tenant_id)
        .eq('idempotency_key', task.idempotency_key)
        .maybeSingle();

      if (idem?.state === 'completed') {
        await transitionTask({
          tenantId: task.tenant_id,
          taskId: task.id,
          to: 'COMPLETED',
          trigger: 'provider_reconcile',
          expectedVersion: task.version,
          patch: { structured_output: idem.result || {} },
        });
        repaired += 1;
        continue;
      }
    }

    await openIntervention({
      tenantId: task.tenant_id,
      runId: task.run_id,
      taskId: task.id,
      category: 'execution_uncertain',
      title: `Needs verification: ${task.title}`,
      detail: 'Worker crashed or timed out after a possible side effect',
      suggestedResolution: 'Verify provider state, then retry or mark complete',
    });
  }
  await logRepair('uncertain_executions', repaired, { reviewed: (data || []).length });
  return { repaired, reviewed: (data || []).length };
}

export async function reconcileExpiredSubscriptions(limit = 40) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from('agent_event_subscriptions')
    .select('*')
    .eq('status', 'active')
    .lt('expires_at', now)
    .limit(limit);

  let repaired = 0;
  for (const sub of data || []) {
    await admin
      .from('agent_event_subscriptions')
      .update({ status: 'expired', updated_at: now })
      .eq('id', sub.id)
      .eq('status', 'active');

    const action = sub.timeout_behavior?.action || 'escalate';
    if (action === 'ready' || action === 'retry') {
      await transitionTask({
        tenantId: sub.tenant_id,
        taskId: sub.waiting_task_id,
        to: 'READY',
        trigger: 'subscription_timeout',
      });
      await insertOutboxEvent({
        tenantId: sub.tenant_id,
        eventType: 'task.ready',
        payload: {
          task_id: sub.waiting_task_id,
          run_id: sub.run_id,
          tenant_id: sub.tenant_id,
        },
      });
    } else {
      await openIntervention({
        tenantId: sub.tenant_id,
        runId: sub.run_id,
        taskId: sub.waiting_task_id,
        category: 'deadline_approaching',
        title: 'Waiting subscription expired',
        detail: `Event ${sub.event_type} not received before timeout`,
      });
    }
    repaired += 1;
  }
  await logRepair('expired_subscriptions', repaired, {});
  return { repaired };
}

export async function reconcileChaseScan(limit = 20) {
  if (!isChaserGloballyEnabled()) return { detected: 0, tenants: 0 };
  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id').limit(limit);
  let detected = 0;
  for (const t of tenants || []) {
    const r = await runChaseScanForTenant(t.id);
    detected += r.detected;
  }
  await logRepair('chase_scan', detected, { tenants: tenants?.length ?? 0 });
  return { detected, tenants: tenants?.length ?? 0 };
}

export async function reconcileChaseExecution(limit = 20) {
  const r = await executeDueChasesAllTenants(limit);
  await logRepair('chase_execution', r.executed, r);
  return r;
}

export async function runFullReconciliation() {
  const leases = await reclaimExpiredLeases(40);
  const outbox = await publishOutboxBatch(50);
  const inbox = await processPendingInbox(40);
  const timers = await fireDueTimers(50);
  const approvals = await reconcileExpiredApprovals(40);
  const ready = await reconcileReadyWithoutOutbox(40);
  const uncertain = await reconcileUncertainExecutions(20);
  const subs = await reconcileExpiredSubscriptions(40);
  const scheduled = await scheduleReadyTasks({ limit: 80 });
  const receipts = await reconcileAllTenantsExecutionReceipts(25);
  const chaseScan = await reconcileChaseScan(20);
  const chaseExec = await reconcileChaseExecution(20);

  return {
    leases,
    outbox,
    inbox,
    timers,
    approvals,
    ready,
    uncertain,
    subs,
    scheduled,
    receipts,
    chaseScan,
    chaseExec,
  };
}
