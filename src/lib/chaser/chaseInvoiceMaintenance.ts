/**
 * Invoice maintenance during chaser scan — mark past-due invoices overdue.
 * Replaces legacy process-invoice-overdue-reminders phase-1 logic.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { guardCronTenantRow } from '@/lib/tenant/cronTenantGuard';

export type MarkOverdueInvoicesResult = {
  markedOverdue: number;
  errors: string[];
};

export async function markOverdueInvoicesForTenant(tenantId: string): Promise<MarkOverdueInvoicesResult> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayIso = now.toISOString().split('T')[0];
  let markedOverdue = 0;
  const errors: string[] = [];

  const { data: sentInvoices, error: sentError } = await admin
    .from('business_invoices')
    .select('id, tenant_id, client_id, invoice_number, status, due_date, sent_at')
    .eq('tenant_id', tenantId)
    .lt('due_date', todayIso)
    .in('status', ['sent', 'viewed']);

  if (sentError) {
    return { markedOverdue: 0, errors: [sentError.message] };
  }

  for (const invoice of sentInvoices || []) {
    const guard = await guardCronTenantRow(invoice, 'business_invoices', { phase: 'mark_overdue' });
    if (!guard.ok) continue;

    const { error: updateError } = await admin
      .from('business_invoices')
      .update({ status: 'overdue', lifecycle_status: 'overdue', updated_at: nowIso })
      .eq('id', invoice.id)
      .eq('tenant_id', invoice.tenant_id);

    if (updateError) {
      errors.push(updateError.message);
      continue;
    }

    await logInvoiceEvent({
      invoiceId: invoice.id,
      tenantId: invoice.tenant_id,
      eventType: 'status_changed',
      eventData: { from: invoice.status, to: 'overdue', reason: 'past_due_date' },
      performedBy: 'system',
    }).catch((err) => errors.push(String(err)));

    const { dispatchBusinessNotification } = await import('@/lib/notifications/businessNotificationEngine');
    await dispatchBusinessNotification({
      tenantId: invoice.tenant_id,
      level: 'level3_urgent_email',
      type: 'finance',
      title: `Invoice #${invoice.invoice_number} is Overdue`,
      message: `Invoice #${invoice.invoice_number} has passed its due date (${invoice.due_date}) and requires immediate follow-up.`,
      actionUrl: `/dashboard/finance/invoices?id=${invoice.id}`,
      topic: `Invoice #${invoice.invoice_number}`,
      actionRequired: 'Follow up with client for payment or re-send payment link.',
      responsibleRole: 'finance_owner',
      actorName: 'System Automation',
      businessContext: 'Past due date reached without payment confirmation.',
      relatedRecordType: 'invoice',
      relatedRecordId: invoice.id,
      result: 'Invoice status updated to overdue',
      status: 'at_risk',
      nextAction: 'Contact client finance team for payment status.',
      technicalDetails: { due_date: invoice.due_date, previous_status: invoice.status },
    }).catch((err) => errors.push(String(err)));

    markedOverdue += 1;
  }

  return { markedOverdue, errors };
}

export async function markOverdueInvoicesAllTenants(limit = 50): Promise<{
  tenants: number;
  markedOverdue: number;
  errors: string[];
}> {
  const admin = createSupabaseAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id').limit(limit);
  let markedOverdue = 0;
  const errors: string[] = [];
  for (const t of tenants || []) {
    const r = await markOverdueInvoicesForTenant(t.id);
    markedOverdue += r.markedOverdue;
    errors.push(...r.errors);
  }
  return { tenants: tenants?.length || 0, markedOverdue, errors };
}
