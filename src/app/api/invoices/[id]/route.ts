import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const invoiceRouteSchema = z.object({
    tenantId: z.string().uuid(),
});

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
