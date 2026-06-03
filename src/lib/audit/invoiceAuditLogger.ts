import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type InvoiceEventType =
  | 'created'
  | 'edited'
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
  eventData?: Record<string, any>;
  performedBy?: string; // user UUID or 'system'
}

/**
 * Logs an event to the immutable invoice_audit_log table.
 * This table is INSERT-only at the RLS policy level — no updates or deletes.
 * Safe to call in a fire-and-forget pattern (swallows errors to avoid breaking callers).
 */
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
    if (error) {
      console.error('[invoiceAuditLogger] Failed to log event:', eventType, error.message);
    }
  } catch (err) {
    console.error('[invoiceAuditLogger] Unexpected error:', err);
  }
}
