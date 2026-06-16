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

/**
 * Create a new invoice with proper audit trail
 */
export async function createInvoice(params: {
  tenantId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  amount: number;
  description: string;
  dueDate?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  performedBy?: string;
}): Promise<{ invoiceId: string | null; error: string | null }> {
  try {
    const admin = createSupabaseAdminClient();
    
    // Create the invoice
    const { data: invoice, error: createError } = await admin
      .from('business_invoices')
      .insert({
        tenant_id: params.tenantId,
        client_id: params.clientId,
        client_name: params.clientName,
        client_email: params.clientEmail || null,
        amount: params.amount,
        description: params.description,
        due_date: params.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        line_items: params.lineItems || [{ description: params.description, quantity: 1, unitPrice: params.amount, total: params.amount }],
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;

    // Log the creation event
    await logInvoiceEvent({
      invoiceId: invoice.id,
      tenantId: params.tenantId,
      eventType: 'created',
      eventData: {
        amount: params.amount,
        clientName: params.clientName,
        description: params.description,
        lineItems: params.lineItems,
      },
      performedBy: params.performedBy || 'system',
    });

    return { invoiceId: invoice.id, error: null };
  } catch (err: any) {
    console.error('[invoiceAuditLogger] Failed to create invoice:', err);
    return { invoiceId: null, error: err.message || 'Failed to create invoice' };
  }
}

/**
 * Send an invoice via email with proper audit trail
 */
export async function sendInvoice(params: {
  invoiceId: string;
  tenantId: string;
  toEmail: string;
  performedBy?: string;
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const admin = createSupabaseAdminClient();
    
    // Update invoice status to sent
    const { error: updateError } = await admin
      .from('business_invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.invoiceId)
      .eq('tenant_id', params.tenantId);

    if (updateError) throw updateError;

    // Log the send event
    await logInvoiceEvent({
      invoiceId: params.invoiceId,
      tenantId: params.tenantId,
      eventType: 'sent',
      eventData: {
        toEmail: params.toEmail,
        sentAt: new Date().toISOString(),
      },
      performedBy: params.performedBy || 'system',
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error('[invoiceAuditLogger] Failed to send invoice:', err);
    return { success: false, error: err.message || 'Failed to send invoice' };
  }
}
