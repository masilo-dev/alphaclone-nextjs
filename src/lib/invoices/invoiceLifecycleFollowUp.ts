/**
 * Bonnie durable timers for invoice reminder + overdue escalation.
 * Uses due-date-aware ladder (not fixed 7-day-from-send).
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createTimer } from '@/lib/bonnie/runtime/timerService';
import {
  checkInvoicePaymentSettled,
  escalateInvoiceOverduePhase,
  sendInvoiceReminderPhase,
} from '@/lib/invoices/invoiceLifecycleSteps';
import {
  computeInitialInvoiceLifecycleTimer,
  computeNextInvoiceLifecycleTimer,
  type InvoiceLifecyclePhase,
} from '@/lib/invoices/invoiceLifecycleSchedule';

export interface InvoiceReminderGuard {
  canDispatch: boolean;
  reason?: string;
  dueDate: string | null;
  status: string;
}

export async function checkInvoiceReminderEligibility(
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceReminderGuard> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('business_invoices')
    .select('due_date, status, metadata, is_test')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();

  if (error || !data) {
    return { canDispatch: false, reason: 'Invoice not found', dueDate: null, status: 'unknown' };
  }

  const status = String(data.status || '').toLowerCase().trim();
  const dueDate = data.due_date ? String(data.due_date).slice(0, 10) : null;
  const isQa = Boolean(data.is_test || (data.metadata as any)?.is_qa || (data.metadata as any)?.qa_record);
  const remindersDisabled = (data.metadata as any)?.reminders_enabled === false;

  if (status === 'draft') {
    return { canDispatch: false, reason: 'Invoices in draft status cannot dispatch reminders', dueDate, status };
  }
  if (isQa) {
    return { canDispatch: false, reason: 'Restricted QA / test records cannot dispatch reminders', dueDate, status };
  }
  if (remindersDisabled) {
    return { canDispatch: false, reason: 'Reminders are disabled for this invoice', dueDate, status };
  }
  if (!dueDate) {
    return { canDispatch: false, reason: 'Invoice has no due date', dueDate: null, status };
  }
  if (status === 'paid' || status === 'cancelled' || status === 'void') {
    return { canDispatch: false, reason: `Invoice is ${status}`, dueDate, status };
  }

  return { canDispatch: true, dueDate, status };
}

async function loadInvoiceDueDate(
  tenantId: string,
  invoiceId: string,
): Promise<string | null> {
  const guard = await checkInvoiceReminderEligibility(tenantId, invoiceId);
  return guard.dueDate;
}

async function recordInvoiceReminderLedger(
  tenantId: string,
  invoiceId: string,
  phase: InvoiceLifecyclePhase,
  sentTo?: string | null,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('invoice_reminders').insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    reminder_type: phase,
    sent_to: sentTo || null,
    sent_at: new Date().toISOString(),
    status: 'sent',
    metadata: { source: 'invoice.lifecycle', phase },
  });
}

async function scheduleNextPhase(params: {
  tenantId: string;
  invoiceId: string;
  dueDate: string;
  currentPhase: InvoiceLifecyclePhase;
  runId?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  const next = computeNextInvoiceLifecycleTimer({
    dueDate: params.dueDate,
    currentPhase: params.currentPhase,
  });
  if (!next) return;

  await createTimer({
    tenantId: params.tenantId,
    runId: params.runId || null,
    executeAt: next.executeAt.toISOString(),
    timerType: 'schedule',
    payload: {
      kind: 'invoice.lifecycle',
      phase: next.phase,
      invoice_id: params.invoiceId,
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId || null,
      due_date: params.dueDate,
    },
  });
}

export async function scheduleInvoiceLifecycleFollowUp(params: {
  tenantId: string;
  invoiceId: string;
  actorUserId?: string;
  runId?: string;
}): Promise<void> {
  const guard = await checkInvoiceReminderEligibility(params.tenantId, params.invoiceId);
  if (!guard.canDispatch) {
    console.info('[scheduleInvoiceLifecycleFollowUp] Timer scheduling skipped:', guard.reason, {
      invoiceId: params.invoiceId,
    });
    return;
  }
  const dueDate = guard.dueDate!;

  const initial = computeInitialInvoiceLifecycleTimer({ dueDate });
  if (!initial) return;

  await createTimer({
    tenantId: params.tenantId,
    runId: params.runId || null,
    executeAt: initial.executeAt.toISOString(),
    timerType: 'schedule',
    payload: {
      kind: 'invoice.lifecycle',
      phase: initial.phase,
      invoice_id: params.invoiceId,
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId || null,
      due_date: dueDate,
    },
  });
}

export async function handleInvoiceLifecycleTimer(timer: {
  tenant_id: string;
  payload?: Record<string, unknown> | null;
  run_id?: string | null;
}): Promise<void> {
  const payload = (timer.payload || {}) as Record<string, unknown>;
  const phase = String(payload.phase || '') as InvoiceLifecyclePhase;
  const invoiceId = String(payload.invoice_id || '');
  const tenantId = String(payload.tenant_id || timer.tenant_id);
  const actorUserId =
    typeof payload.actor_user_id === 'string' ? payload.actor_user_id : undefined;

  if (!invoiceId || !tenantId) return;

  const guard = await checkInvoiceReminderEligibility(tenantId, invoiceId);
  if (!guard.canDispatch) {
    console.info('[handleInvoiceLifecycleTimer] Timer execution blocked:', guard.reason, {
      invoiceId,
    });
    return;
  }
  const dueDate = guard.dueDate!;

  if (await checkInvoicePaymentSettled(invoiceId, tenantId)) return;

  if (phase === 'escalate') {
    await escalateInvoiceOverduePhase(invoiceId, tenantId, actorUserId);
    await recordInvoiceReminderLedger(tenantId, invoiceId, phase);
    return;
  }

  if (
    phase === 'upcoming' ||
    phase === 'due_today' ||
    phase === 'overdue_1' ||
    phase === 'overdue_7' ||
    phase === 'overdue_14'
  ) {
    await sendInvoiceReminderPhase(invoiceId, tenantId);
    await recordInvoiceReminderLedger(tenantId, invoiceId, phase);
    await scheduleNextPhase({
      tenantId,
      invoiceId,
      dueDate,
      currentPhase: phase,
      runId: timer.run_id,
      actorUserId: actorUserId || null,
    });
  }
}
