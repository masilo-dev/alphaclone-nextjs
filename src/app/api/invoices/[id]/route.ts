import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';


const invoiceRouteSchema = z.object({
    tenantId: z.string().uuid(),
});

const UpdateInvoiceSchema = z.object({
    total: z.number().min(0, 'Total cannot be negative').optional(),
    subtotal: z.number().min(0).optional(),
    tax: z.number().min(0).optional(),
    due_date: z.union([z.string().date(), z.string().datetime()]).optional(),
    issue_date: z.union([z.string().date(), z.string().datetime()]).optional(),
    notes: z.string().optional(),
    status: z.enum(['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'disputed', 'void', 'cancelled']).optional(),
    line_items: z.array(z.object({
        description: z.string(),
        quantity: z.number().min(0),
        unit_price: z.number().min(0),
    })).optional(),
    client_id: z.string().uuid().nullable().optional(),
    project_id: z.string().uuid().nullable().optional(),
    tax_rate: z.number().min(0).max(100).optional(),
    discount_amount: z.number().min(0).optional(),
    is_public: z.boolean().optional(),
    sender_name: z.string().max(300).nullable().optional(),
    bank_details: z.string().max(10_000).nullable().optional(),
    mobile_payment_details: z.string().max(10_000).nullable().optional(),
    signature: z.union([z.string().max(2_000_000), z.object({ type: z.enum(['draw', 'type']), data: z.string().max(2_000_000) }), z.null()]).optional(),
    tenantId: z.string().uuid(),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    let quotaReservation: { tenantId: string; userId: string } | null = null;
    try {
        const { id } = await context.params;
        const body = await req.json();
        const parsed = UpdateInvoiceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
        }

        const { tenantId, ...updatePayload } = parsed.data;
        const { user } = await requireTenantAccess(tenantId, req);
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
        if (updatePayload.client_id) {
            const { data } = await admin.from('business_clients').select('id').eq('id', updatePayload.client_id).eq('tenant_id', tenantId).maybeSingle();
            if (!data) return NextResponse.json({ error: 'Client is not in this workspace' }, { status: 422 });
        }
        if (updatePayload.project_id) {
            const { data } = await admin.from('projects').select('id').eq('id', updatePayload.project_id).eq('tenant_id', tenantId).maybeSingle();
            if (!data) return NextResponse.json({ error: 'Project is not in this workspace' }, { status: 422 });
        }

        // 2. Security Guards
        const lockedStatuses = ['sent', 'paid', 'overdue'];
        const isModifyingTotals = updatePayload.total !== undefined || updatePayload.subtotal !== undefined || updatePayload.tax !== undefined;

        if (lockedStatuses.includes(existing.status) && isModifyingTotals) {
            return NextResponse.json(
                { error: 'Cannot modify totals on a locked invoice (sent, paid, or overdue). Void it first and create a new one.' },
                { status: 409 }
            );
        }
        if (existing.status === 'draft' && updatePayload.status && updatePayload.status !== 'draft') {
            await consumeDailyResourceQuota(tenantId, user.id, 'invoices');
            quotaReservation = { tenantId, userId: user.id };
        }

        // 3. Handle paid_at and delivery_status when status changes to 'paid'
        const finalPayload: any = { ...updatePayload };
        if (finalPayload.due_date) finalPayload.due_date = finalPayload.due_date.slice(0, 10);
        if (finalPayload.issue_date) finalPayload.issue_date = finalPayload.issue_date.slice(0, 10);
        if (updatePayload.status) {
            if (updatePayload.status === 'paid') {
                // Set paid_at if not already set
                if (!existing.paid_at) {
                    finalPayload.paid_at = new Date().toISOString();
                    finalPayload.delivery_status = 'DELIVERED';
                }
                // Clear any previous paid_at if status is being changed away from paid
            } else {
                finalPayload.paid_at = null;
            }
        }

        // 4. Update header and relational line items in one database transaction.
        const { data: rows, error: updateError } = await admin.rpc('update_business_invoice_atomic', {
            p_tenant_id: tenantId,
            p_invoice_id: id,
            p_updates: finalPayload,
            p_items: updatePayload.line_items || null,
        });

        if (updateError) throw updateError;
        const updated = Array.isArray(rows) ? rows[0] : rows;
        quotaReservation = null;

        // Audit log — invoice_audit_log for invoice-specific events
        if (updatePayload.status && existing.status !== updatePayload.status) {
            await logInvoiceEvent({
                invoiceId: id,
                tenantId,
                eventType: 'status_changed',
                eventData: { from: existing.status, to: updatePayload.status },
                performedBy: user.id,
            }).catch((error) => console.error('[invoices] status audit failed', error));
        } else if (Object.keys(finalPayload).filter((k: string) => k !== 'updated_at').length > 0) {
            await logInvoiceEvent({
                invoiceId: id,
                tenantId,
                eventType: 'edited',
                eventData: { fields: Object.keys(finalPayload) },
                performedBy: user.id,
            }).catch((error) => console.error('[invoices] edit audit failed', error));
        }

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        if (quotaReservation) await releaseDailyResourceQuota(quotaReservation.tenantId, quotaReservation.userId, 'invoices');
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
        const { user } = await requireTenantAccess(tenantId, req);
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

        if (invoice.status !== 'draft') return NextResponse.json({ error: `Invoice ${invoice.invoice_number} has been issued and cannot be deleted. Void it with a reason instead.`, code: 'INVOICE_DELETE_FORBIDDEN', action: 'POST /api/invoices/[id]/void' }, { status: 409 });
        const { error: lineError } = await admin.from('invoice_line_items').delete().eq('invoice_id', id).eq('tenant_id', tenantId);
        if (lineError) throw lineError;
        const { error: deleteError } = await admin.from('business_invoices').delete().eq('id', id).eq('tenant_id', tenantId);
        if (deleteError) throw deleteError;
        await logInvoiceEvent({ invoiceId: id, tenantId, eventType: 'deleted', eventData: { invoiceNumber: invoice.invoice_number }, performedBy: user.id }).catch((error) => console.error('[invoices] delete audit failed', error));
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to process invoice delete request', req);
    }
}
