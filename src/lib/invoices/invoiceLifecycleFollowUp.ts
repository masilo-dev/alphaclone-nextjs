/**
 * Bonnie durable timers for invoice reminder + overdue escalation.
 */

import { createTimer } from '@/lib/bonnie/runtime/timerService';
import {
  checkInvoicePaymentSettled,
  escalateInvoiceOverduePhase,
  sendInvoiceReminderPhase,
} from '@/lib/invoices/invoiceLifecycleSteps';

const SEVEN_DAYS_MS = 7 * 86400_000;

export async function scheduleInvoiceLifecycleFollowUp(params: {
  tenantId: string;
  invoiceId: string;
  actorUserId?: string;
  runId?: string;
}): Promise<void> {
  await createTimer({
    tenantId: params.tenantId,
    runId: params.runId || null,
    executeAt: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
    timerType: 'invoice.lifecycle',
    payload: {
      phase: 'reminder',
      invoice_id: params.invoiceId,
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId || null,
    },
  });
}

export async function handleInvoiceLifecycleTimer(timer: {
  tenant_id: string;
  payload?: Record<string, unknown> | null;
  run_id?: string | null;
}): Promise<void> {
  const payload = (timer.payload || {}) as Record<string, unknown>;
  const phase = String(payload.phase || '');
  const invoiceId = String(payload.invoice_id || '');
  const tenantId = String(payload.tenant_id || timer.tenant_id);
  const actorUserId =
    typeof payload.actor_user_id === 'string' ? payload.actor_user_id : undefined;

  if (!invoiceId || !tenantId) return;

  if (await checkInvoicePaymentSettled(invoiceId, tenantId)) return;

  if (phase === 'reminder') {
    await sendInvoiceReminderPhase(invoiceId, tenantId);
    await createTimer({
      tenantId,
      runId: timer.run_id || null,
      executeAt: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
      timerType: 'invoice.lifecycle',
      payload: {
        phase: 'escalate',
        invoice_id: invoiceId,
        tenant_id: tenantId,
        actor_user_id: actorUserId || null,
      },
    });
    return;
  }

  if (phase === 'escalate') {
    await escalateInvoiceOverduePhase(invoiceId, tenantId, actorUserId);
  }
}
