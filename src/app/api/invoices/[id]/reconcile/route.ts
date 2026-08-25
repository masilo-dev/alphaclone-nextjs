import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { emitTenantBusinessEvent } from '@/lib/notifications/emitTenantBusinessEvent';

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

    const { tenantId, payment_ref, amount, paid_at, provider } = parsed.data;
    const { user } = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // 1. Fetch invoice
    const { data: invoice, error: fetchError } = await admin
      .from('business_invoices')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // 2. Status checks
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice already paid', code: 'ALREADY_PAID' }, { status: 409 });
    }
    if (invoice.status === 'void' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot pay a void or cancelled invoice', code: 'INVALID_STATUS' }, { status: 409 });
    }

    // 3. Update invoice
    if (amount < invoice.total) {
      return NextResponse.json({ error: 'Partial payments not supported via this endpoint. Amount must match or exceed total.', total: invoice.total }, { status: 422 });
    }

    const { data: updated, error: updateError } = await admin
      .from('business_invoices')
      .update({
        status: 'paid',
        paid_at: paid_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Audit Log
    await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'invoice_paid',
      entity_type: 'invoice',
      entity_id: id,
      new_values: { 
        status: 'paid', 
        payment_ref, 
        provider, 
        amount 
      },
      old_values: invoice,
      created_at: new Date().toISOString()
    });

    const { data: client } = invoice.client_id
      ? await admin.from('business_clients').select('name').eq('tenant_id', tenantId).eq('id', invoice.client_id).maybeSingle()
      : { data: null };

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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to reconcile invoice payment', req);
  }
}
