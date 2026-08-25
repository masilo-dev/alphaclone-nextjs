import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';

const schema = z.object({
  tenantId: z.string().uuid(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid invoice ID required' }, { status: 400 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid tenantId and positive payment amount required' }, { status: 400 });
    const { tenantId, amount, idempotencyKey } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    const { data: rows, error } = await admin.rpc('record_business_invoice_payment', {
      p_tenant_id: tenantId,
      p_invoice_id: id,
      p_amount: amount,
      p_idempotency_key: idempotencyKey,
      p_source: 'manual',
      p_external_reference: null,
      p_actor_user_id: user.id,
    });
    if (error) {
      if (/not found/i.test(error.message)) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      if (/already paid|exceeds|cannot accept|idempotency key/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    const invoice = Array.isArray(rows) ? rows[0] : rows;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    await logInvoiceEvent({ invoiceId: id, tenantId, eventType: 'payment_received', eventData: { amount, amountPaid: invoice.amount_paid, status: invoice.status }, performedBy: user.id })
      .catch((auditError) => console.error('[invoice-payment] audit failed', auditError));

    if (String(invoice.status).toLowerCase() === 'paid') {
      await emitTenantBusinessEvent({
        tenantId,
        userId: user.id,
        eventType: 'invoice.paid',
        source: 'system',
        title: `Invoice paid #${invoice.invoice_number || id.slice(0, 8)}`,
        message: `Payment recorded — ${amount} applied.`,
        actionUrl: '/dashboard/business/invoices',
        entityType: 'invoice',
        entityId: id,
        status: 'success',
        metadata: { amount, idempotencyKey },
      }).catch(() => undefined);
    }

    return NextResponse.json({ invoice });
  } catch (error) { return routeErrorResponse(error, 'Payment could not be recorded', req); }
}
