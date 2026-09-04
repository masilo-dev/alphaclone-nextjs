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

async function loadInvoiceDueDate(
  tenantId: string,
  invoiceId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('business_invoices')
    .select('due_date')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) throw error;
  return data?.due_date ? String(data.due_date).slice(0, 10) : null;
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
    timerType: 'invoice.lifecycle',
    payload: {
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
  const dueDate = await loadInvoiceDueDate(params.tenantId, params.invoiceId);
  if (!dueDate) {
    console.warn('[scheduleInvoiceLifecycleFollowUp] missing due_date — skipping timer', {
      invoiceId: params.invoiceId,
    });
    return;
  }

  const initial = computeInitialInvoiceLifecycleTimer({ dueDate });
  if (!initial) return;

  await createTimer({
    tenantId: params.tenantId,
    runId: params.runId || null,
    executeAt: initial.executeAt.toISOString(),
    timerType: 'invoice.lifecycle',
    payload: {
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
  const dueDate = String(payload.due_date || '') || (await loadInvoiceDueDate(tenantId, invoiceId));
  const actorUserId =
    typeof payload.actor_user_id === 'string' ? payload.actor_user_id : undefined;

  if (!invoiceId || !tenantId || !dueDate) return;

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
