import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';
import { recordInvoicePaymentServer } from '@/lib/invoices/recordInvoicePaymentServer';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

const ReconcileSchema = z.object({
  payment_ref: z.string().min(1, 'payment_ref is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  paid_at: z.string().datetime().optional(),
  provider: z.enum(['stripe', 'bank_transfer', 'cash', 'other']).optional(),
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = ReconcileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, payment_ref, amount, provider } = parsed.data;
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();

    const { data: invoice, error: fetchError } = await admin
      .from('business_invoices')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice already paid', code: 'ALREADY_PAID' }, { status: 409 });
    }
    if (invoice.status === 'void' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot pay a void or cancelled invoice', code: 'INVALID_STATUS' }, { status: 409 });
    }

    const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
    if (amount > remaining + 0.001) {
      return NextResponse.json(
        { error: 'Payment exceeds remaining balance', total: invoice.total, remaining },
        { status: 422 },
      );
    }

    const updated = await recordInvoicePaymentServer(admin, {
      tenantId,
      invoiceId: id,
      amount,
      idempotencyKey: `reconcile:${provider || 'manual'}:${payment_ref}`,
      source: provider || 'manual',
      externalReference: payment_ref,
      actorUserId: user.id,
    });

    await logInvoiceEvent({
      invoiceId: id,
      tenantId,
      eventType: 'payment_received',
      eventData: { amount, payment_ref, provider, status: updated.status },
      performedBy: user.id,
    }).catch(() => undefined);

    const { data: client } = invoice.client_id
      ? await admin.from('business_clients').select('name').eq('tenant_id', tenantId).eq('id', invoice.client_id).maybeSingle()
      : { data: null };

    if (String(updated.status).toLowerCase() === 'paid') {
      await emitTenantBusinessEvent({
        tenantId,
        userId: user.id,
        eventType: 'invoice.paid',
        source: 'system',
        title: `Invoice paid #${invoice.invoice_number || id.slice(0, 8)}`,
        message: `Payment of ${amount} received${client?.name ? ` from ${client.name}` : ''}.`,
        actionUrl: '/dashboard/business/invoices',
        entityType: 'invoice',
        entityId: id,
        clientName: client?.name,
        status: 'success',
        metadata: { payment_ref, provider, amount },
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to reconcile invoice payment', req);
  }
}
