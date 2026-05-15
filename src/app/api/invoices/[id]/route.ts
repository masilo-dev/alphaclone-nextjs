import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const invoiceRouteSchema = z.object({
    tenantId: z.string().uuid(),
});

const UpdateInvoiceSchema = z.object({
    total: z.number().min(0, 'Total cannot be negative').optional(),
    subtotal: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    due_date: z.string().datetime().optional(),
    notes: z.string().optional(),
    status: z.enum(['draft', 'sent', 'overdue', 'cancelled', 'void']).optional(),
    line_items: z.array(z.object({
        description: z.string(),
        quantity: z.number().min(0),
        unit_price: z.number().min(0),
    })).optional(),
    tenantId: z.string().uuid(),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const body = await req.json();
        const parsed = UpdateInvoiceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
        }

        const { tenantId, ...updatePayload } = parsed.data;
        const { user } = await requireTenantAccess(tenantId);
        const admin = createAdminSupabaseClientOrThrow();

        // 1. Fetch existing invoice
        const { data: existing, error: fetchError } = await admin
            .from('business_invoices')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        // 2. Security Guards
        if ((body as any).status === 'paid') {
            return NextResponse.json(
                { error: 'Invoice cannot be marked paid via direct update. Use the reconcile_payment endpoint with a valid payment_ref.' },
                { status: 403 }
            );
        }

        const lockedStatuses = ['sent', 'paid', 'overdue'];
        const isModifyingTotals = updatePayload.total !== undefined || updatePayload.subtotal !== undefined || updatePayload.tax !== undefined;

        if (lockedStatuses.includes(existing.status) && isModifyingTotals) {
            return NextResponse.json(
                { error: 'Cannot modify totals on a locked invoice (sent, paid, or overdue). Void it first and create a new one.' },
                { status: 409 }
            );
        }

        // 3. Clear paid_at if status is being changed away from paid
        const finalPayload: any = { ...updatePayload };
        if (updatePayload.status) {
            finalPayload.paid_at = null;
        }

        // 4. Update Database
        const { data: updated, error: updateError } = await admin
            .from('business_invoices')
            .update({
                ...finalPayload,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (updateError) throw updateError;

        // 5. Audit Log
        await admin.from('audit_logs').insert({
            tenant_id: tenantId,
            user_id: user.id,
            action: 'invoice_updated',
            entity_type: 'invoice',
            entity_id: id,
            new_values: finalPayload,
            old_values: existing,
            created_at: new Date().toISOString()
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to update invoice', req);
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const payload = await req.json();
        const parsed = invoiceRouteSchema.safeParse(payload);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }

        const { tenantId } = parsed.data;
        await requireTenantAccess(tenantId);
        const admin = createAdminSupabaseClientOrThrow();

        const { data: invoice, error } = await admin
            .from('business_invoices')
            .select('id,status,invoice_number')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (error || !invoice) {
            return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 });
        }

        return NextResponse.json(
            {
                error: `Invoice ${invoice.invoice_number} cannot be deleted. Use void endpoint with reason.`,
                code: 'INVOICE_DELETE_FORBIDDEN',
                action: 'POST /api/invoices/[id]/void',
            },
            { status: 409 }
        );
    } catch (error) {
        return routeErrorResponse(error, 'Failed to process invoice delete request', req);
    }
}
