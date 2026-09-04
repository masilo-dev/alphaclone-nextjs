/**
 * Universal Chaser executor — phases 2–4 action ladder with receipts.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mapWithConcurrency } from '@/lib/concurrency/mapWithConcurrency';
import {
  CHASER_CONCURRENCY,
  getUniversalChaserPhase,
  isChaserEnabledForTenant,
  isPolicyEnabledForTenant,
  resolveEffectiveAutomationMode,
} from '@/lib/chaser/chaseConfig';
import { getChasePolicy } from '@/lib/chaser/policyRegistry';
import { verifyChaseStopCondition } from '@/lib/chaser/chaseStopConditions';
import {
  getChaseInstanceById,
  transitionChaseState,
} from '@/lib/chaser/chaseInstanceService';
import { recordChaseAttempt, updateChaseAttemptDelivery } from '@/lib/chaser/chaseAttemptService';
import type { ChaseInstanceRow } from '@/lib/chaser/types';

function computeNextActionAt(policyKey: string, attempt: number): string {
  const policy = getChasePolicy(policyKey as any);
  const hours = policy.defaultIntervalHours[Math.min(attempt, policy.defaultIntervalHours.length - 1)] || 72;
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export async function listDueChaseInstances(
  tenantId: string,
  limit = 25,
): Promise<ChaseInstanceRow[]> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data } = await admin
    .from('chase_instances')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('state', ['DETECTED', 'PLANNED', 'READY'])
    .lte('next_action_at', now)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order('next_action_at', { ascending: true })
    .limit(limit);
  return (data || []) as ChaseInstanceRow[];
}

async function createInternalOwnerTask(chase: ChaseInstanceRow, title: string, description: string) {
  const admin = createSupabaseAdminClient();
  const sourceKey = `chase_internal:${chase.id}:${chase.attempt_count + 1}`;
  const { data: existing } = await admin
    .from('tasks')
    .select('id')
    .eq('tenant_id', chase.tenant_id)
    .contains('metadata', { autoSourceKey: sourceKey })
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data } = await admin
    .from('tasks')
    .insert({
      tenant_id: chase.tenant_id,
      title,
      description,
      status: 'pending',
      assigned_to: chase.assignee_user_id || chase.owner_user_id,
      related_to_project: chase.related_project_id,
      related_to_contact: chase.related_contact_id,
      metadata: {
        autoSourceKey: sourceKey,
        chase_id: chase.id,
        policy_key: chase.policy_key,
        source: 'universal_chaser',
      },
    })
    .select('id')
    .single();
  return data?.id || null;
}

async function queueApprovalForChase(chase: ChaseInstanceRow, draft: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('autonomous_runner_approvals')
    .insert({
      tenant_id: chase.tenant_id,
      action_key: `chase:${chase.policy_key}:${chase.id}`,
      risk_level: 'medium',
      status: 'pending',
      reason: `Chase approval for ${chase.policy_key}`,
      payload: {
        source: 'universal_chaser',
        chase_id: chase.id,
        entity_type: chase.entity_type,
        entity_id: chase.entity_id,
        draft,
      },
      source: 'universal_chaser',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await transitionChaseState(chase.tenant_id, chase.id, {
    state: 'WAITING_FOR_APPROVAL',
    evidence: { approval_id: data.id, draft },
  });
  await admin
    .from('chase_instances')
    .update({ approval_id: data.id, approval_required: true, updated_at: new Date().toISOString() })
    .eq('id', chase.id);
  return data.id as string;
}

async function executeTaskChaserInternal(chase: ChaseInstanceRow): Promise<{ ok: boolean; detail: string }> {
  const admin = createSupabaseAdminClient();
  const { data: task } = await admin
    .from('tasks')
    .select('id, title, due_date, assigned_to, priority, tenant_id, reminder_at')
    .eq('id', chase.entity_id)
    .eq('tenant_id', chase.tenant_id)
    .maybeSingle();
  if (!task) return { ok: false, detail: 'task_not_found' };

  const today = new Date().toISOString().slice(0, 10);
  const type = task.due_date && task.due_date < today ? 'overdue' : 'dueSoon';
  const { sendTaskReminderDirect } = await import('@/lib/cron/taskReminderSender');
  await sendTaskReminderDirect(task, type);
  return { ok: true, detail: `task_reminder_${type}` };
}

async function executeInvoiceChaserExternal(chase: ChaseInstanceRow): Promise<{ ok: boolean; detail: string; provider?: string }> {
  const { sendInvoiceReminderPhase } = await import('@/lib/invoices/invoiceLifecycleSteps');
  await sendInvoiceReminderPhase(chase.entity_id, chase.tenant_id);
  return { ok: true, detail: 'invoice_reminder_sent' };
}

export async function executeChaseInstance(chase: ChaseInstanceRow): Promise<{
  executed: boolean;
  outcome: string;
  approvalId?: string;
}> {
  const stop = await verifyChaseStopCondition(chase);
  if (stop.stopped) {
    await transitionChaseState(chase.tenant_id, chase.id, {
      state: 'RESOLVED',
      terminalOutcome: stop.outcome,
      evidence: { resolved_by: 'stop_condition', at: new Date().toISOString() },
    });
    return { executed: false, outcome: `resolved:${stop.outcome}` };
  }

  const policy = getChasePolicy(chase.policy_key as any);
  const mode = resolveEffectiveAutomationMode({
    policyDefault: policy.defaultAutomationMode,
    policyApprovalRequired: policy.approvalRequired,
    tenantOverride: chase.automation_mode,
  });

  const attemptNumber = chase.attempt_count + 1;
  const admin = createSupabaseAdminClient();

  if (mode === 'observe_only') {
    await transitionChaseState(chase.tenant_id, chase.id, {
      state: 'PLANNED',
      evidence: { observe_only: true, planned_at: new Date().toISOString() },
    });
    await admin
      .from('chase_instances')
      .update({
        next_action_at: computeNextActionAt(chase.policy_key, attemptNumber),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chase.id);
    return { executed: false, outcome: 'planned_observe_only' };
  }

  if (mode === 'internal') {
    let detail = 'internal_task_created';
    if (chase.policy_key === 'task_chaser') {
      const r = await executeTaskChaserInternal(chase);
      detail = r.detail;
    } else {
      await createInternalOwnerTask(
        chase,
        `Chase: ${policy.label}`,
        `${policy.initialAction} (${chase.reason_code || 'stalled'})`,
      );
    }

    const attempt = await recordChaseAttempt({
      tenantId: chase.tenant_id,
      chaseId: chase.id,
      attemptNumber,
      actionKey: 'internal_action',
      deliveryState: 'sent',
      receipt: { detail },
    });

    await admin
      .from('chase_instances')
      .update({
        state: 'WAITING_FOR_OUTCOME',
        attempt_count: attemptNumber,
        last_attempt_at: new Date().toISOString(),
        next_action_at: computeNextActionAt(chase.policy_key, attemptNumber),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chase.id);

    if (attempt.id) {
      await updateChaseAttemptDelivery(attempt.id, chase.tenant_id, { deliveryState: 'sent' });
    }
    return { executed: true, outcome: detail };
  }

  if (mode === 'approval_required') {
    const draft = {
      channel: policy.channel,
      policy_key: chase.policy_key,
      entity_type: chase.entity_type,
      entity_id: chase.entity_id,
      subject: `Follow-up: ${policy.label}`,
      body: policy.initialAction,
      context: chase.context_snapshot,
    };
    const approvalId = await queueApprovalForChase(chase, draft);
    await recordChaseAttempt({
      tenantId: chase.tenant_id,
      chaseId: chase.id,
      attemptNumber,
      actionKey: 'approval_queued',
      deliveryState: 'queued',
      receipt: { approval_id: approvalId },
    });
    await admin
      .from('chase_instances')
      .update({
        attempt_count: attemptNumber,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chase.id);
    return { executed: true, outcome: 'awaiting_approval', approvalId };
  }

  // Phase 4 automated — low-risk policies only
  if (chase.policy_key === 'task_chaser') {
    const r = await executeTaskChaserInternal(chase);
    await recordChaseAttempt({
      tenantId: chase.tenant_id,
      chaseId: chase.id,
      attemptNumber,
      actionKey: 'automated_task_reminder',
      deliveryState: 'sent',
      receipt: { detail: r.detail },
    });
  } else if (chase.policy_key === 'invoice_chaser') {
    const r = await executeInvoiceChaserExternal(chase);
    await recordChaseAttempt({
      tenantId: chase.tenant_id,
      chaseId: chase.id,
      attemptNumber,
      actionKey: 'automated_invoice_reminder',
      deliveryState: r.ok ? 'sent' : 'failed',
      receipt: { detail: r.detail },
    });
  } else {
    const approvalId = await queueApprovalForChase(chase, {
      note: 'Automated mode blocked for policy — approval required',
      policy_key: chase.policy_key,
    });
    return { executed: true, outcome: 'fallback_approval', approvalId };
  }

  await admin
    .from('chase_instances')
    .update({
      state: 'WAITING_FOR_OUTCOME',
      attempt_count: attemptNumber,
      last_attempt_at: new Date().toISOString(),
      next_action_at: computeNextActionAt(chase.policy_key, attemptNumber),
      updated_at: new Date().toISOString(),
    })
    .eq('id', chase.id);

  return { executed: true, outcome: 'automated_executed' };
}

export async function approveAndExecuteChase(
  tenantId: string,
  chaseId: string,
  approverUserId: string,
): Promise<{ ok: boolean; error?: string; outcome?: string }> {
  const { data: chase, error } = await getChaseInstanceById(tenantId, chaseId);
  if (error || !chase) return { ok: false, error: error || 'not_found' };

  const admin = createSupabaseAdminClient();
  if (chase.approval_id) {
    await admin
      .from('autonomous_runner_approvals')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', chase.approval_id)
      .eq('tenant_id', tenantId);
  }

  await transitionChaseState(tenantId, chaseId, {
    state: 'EXECUTING',
    evidence: { approved_by: approverUserId, at: new Date().toISOString() },
  });

  let execOutcome = 'approved';
  if (chase.policy_key === 'invoice_chaser') {
    await executeInvoiceChaserExternal(chase);
    execOutcome = 'invoice_reminder_sent';
  } else if (chase.policy_key === 'quote_proposal_chaser') {
    await createInternalOwnerTask(
      chase,
      'Send quote follow-up (approved)',
      String((chase.context_snapshot as Record<string, unknown>)?.quote_number || 'Quote follow-up'),
    );
    execOutcome = 'quote_followup_task';
  } else {
    await createInternalOwnerTask(chase, `Approved chase: ${chase.policy_key}`, chase.reason_code || '');
  }

  const attemptNumber = chase.attempt_count + 1;
  await recordChaseAttempt({
    tenantId,
    chaseId,
    attemptNumber,
    actionKey: 'approved_external',
    deliveryState: 'sent',
    receipt: { approver_user_id: approverUserId, outcome: execOutcome },
  });

  await transitionChaseState(tenantId, chaseId, {
    state: 'WAITING_FOR_OUTCOME',
    evidence: { last_execution: execOutcome },
  });

  await admin
    .from('chase_instances')
    .update({
      attempt_count: attemptNumber,
      last_attempt_at: new Date().toISOString(),
      next_action_at: computeNextActionAt(chase.policy_key, attemptNumber),
      updated_at: new Date().toISOString(),
    })
    .eq('id', chaseId);

  return { ok: true, outcome: execOutcome };
}

export async function executeDueChasesForTenant(tenantId: string): Promise<{
  processed: number;
  executed: number;
  resolved: number;
  errors: string[];
}> {
  if (!(await isChaserEnabledForTenant(tenantId))) {
    return { processed: 0, executed: 0, resolved: 0, errors: [] };
  }

  const due = await listDueChaseInstances(tenantId, CHASER_CONCURRENCY.crmScan());
  let executed = 0;
  let resolved = 0;
  const errors: string[] = [];

  await mapWithConcurrency(due, CHASER_CONCURRENCY.email(), async (chase) => {
    if (!(await isPolicyEnabledForTenant(tenantId, chase.policy_key as any))) return;
    try {
      const result = await executeChaseInstance(chase);
      if (result.executed) executed += 1;
      if (result.outcome.startsWith('resolved:')) resolved += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  });

  return { processed: due.length, executed, resolved, errors };
}

export async function executeDueChasesAllTenants(limit = 20): Promise<{
  tenants: number;
  processed: number;
  executed: number;
}> {
  if (getUniversalChaserPhase() < 2) {
    return { tenants: 0, processed: 0, executed: 0 };
  }
  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id').limit(limit);
  let processed = 0;
  let executed = 0;
  for (const t of tenants || []) {
    const r = await executeDueChasesForTenant(t.id);
    processed += r.processed;
    executed += r.executed;
  }
  return { tenants: tenants?.length || 0, processed, executed };
}
