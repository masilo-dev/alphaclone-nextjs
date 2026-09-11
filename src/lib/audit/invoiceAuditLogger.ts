import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type InvoiceEventType =
  | 'created'
  | 'edited'
  | 'deleted'
  | 'sent'
  | 'viewed'
  | 'payment_received'
  | 'status_changed'
  | 'reminder_sent'
  | 'dispute_raised'
  | 'voided'
  | 'delivery_confirmed'
  | 'delivery_bounced'
  | 'delivery_opened'
  | 'followup_toggled';

interface LogEventParams {
  invoiceId: string;
  tenantId: string;
  eventType: InvoiceEventType;
  eventData?: Record<string, unknown>;
  performedBy?: string;
}

/** Append an immutable, server-owned event to an invoice's audit trail. */
export async function logInvoiceEvent({
  invoiceId,
  tenantId,
  eventType,
  eventData,
  performedBy = 'system',
}: LogEventParams): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('invoice_audit_log').insert({
      invoice_id: invoiceId,
      tenant_id: tenantId,
      event_type: eventType,
      event_data: eventData ?? {},
      performed_by: performedBy,
      created_at: new Date().toISOString(),
    });
    if (error) console.error('[invoiceAuditLogger] Failed to log event:', eventType, error.message);
  } catch (error) {
    console.error('[invoiceAuditLogger] Unexpected error:', error);
  }
}
