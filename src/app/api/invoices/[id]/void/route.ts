import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const voidInvoiceSchema = z.object({
    tenantId: z.string().uuid(),
    reason: z.string().min(5).max(1000),
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const payload = await req.json();
        const parsed = voidInvoiceSchema.safeParse(payload);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
        }

        const { tenantId, reason } = parsed.data;
        await requireTenantAccess(tenantId);
        const admin = createAdminSupabaseClientOrThrow();

        const { data: invoice, error: fetchError } = await admin
            .from('business_invoices')
            .select('id,status,tenant_id,invoice_number')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();
        if (fetchError || !invoice) {
            return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 });
        }
        if (invoice.status === 'void') {
            return NextResponse.json({ error: 'Invoice is already voided', code: 'ALREADY_VOID' }, { status: 409 });
        }

        const { error } = await admin
            .from('business_invoices')
            .update({
                status: 'void',
                void_reason: reason,
                voided_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (error) throw error;
        return NextResponse.json({ success: true, invoiceId: id, status: 'void' });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to void invoice', req);
    }
}
