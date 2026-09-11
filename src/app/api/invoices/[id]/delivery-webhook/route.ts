import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

/**
 * Delivery webhook receiver for Brevo / Zoho Mail callbacks.
 * Expected payload shape (Brevo example):
 *   { event: 'delivered'|'bounce'|'open', MessageID: '...', ... }
 * We look up the delivery log by provider_msg_id to match.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const body = await req.json();

    // Accept either Brevo or generic format
    const event: string = (body.event || body.type || '').toLowerCase();
    const msgId: string = body.MessageID || body.message_id || body.msg_id || '';
    if (!msgId || !event) {
      return NextResponse.json({ error: 'Provider event and message ID are required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    // Look up the delivery log entry
    const { data: deliveryLog } = await admin
      .from('invoice_delivery_log')
      .select('id, invoice_id, tenant_id, delivery_status')
      .eq('invoice_id', invoiceId)
      .eq('provider_msg_id', msgId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!deliveryLog) {
      return NextResponse.json({ error: 'Provider receipt does not match this invoice' }, { status: 404 });
    }

    let newStatus: 'PENDING' | 'DELIVERED' | 'BOUNCED' | 'OPENED' = deliveryLog.delivery_status;
    const updatePayload: Record<string, any> = { raw_webhook: body };

    if (event.includes('deliver') || event === 'click') {
      newStatus = 'DELIVERED';
      updatePayload.delivered_at = now;
    } else if (event.includes('bounce') || event.includes('hard_bounce') || event.includes('soft_bounce')) {
      newStatus = 'BOUNCED';
      updatePayload.bounced_at = now;
      updatePayload.bounce_reason = body.reason || body.description || '';
    } else if (event.includes('open')) {
      newStatus = 'OPENED';
      updatePayload.delivered_at = now;
      updatePayload.opened_at = now;
    }

    updatePayload.delivery_status = newStatus;

    await admin
      .from('invoice_delivery_log')
      .update(updatePayload)
      .eq('id', deliveryLog.id);

    // Also update the main invoice delivery_status
    await admin
      .from('business_invoices')
      .update({
        delivery_status: newStatus,
        delivery_verified_at: newStatus === 'DELIVERED' || newStatus === 'OPENED' ? now : undefined,
        updated_at: now,
      })
      .eq('id', invoiceId);

    // Audit
    const eventTypeMap: Record<string, any> = {
      DELIVERED: 'delivery_confirmed',
      BOUNCED: 'delivery_bounced',
      OPENED: 'delivery_opened',
    };
    if (eventTypeMap[newStatus]) {
      await logInvoiceEvent({
        invoiceId,
        tenantId: deliveryLog.tenant_id,
        eventType: eventTypeMap[newStatus],
        eventData: { delivery_status: newStatus, provider_event: event, raw: body },
        performedBy: 'system',
      });
    }

    return NextResponse.json({ success: true, deliveryStatus: newStatus });
  } catch (err) {
    console.error('[invoices/delivery-webhook] error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
