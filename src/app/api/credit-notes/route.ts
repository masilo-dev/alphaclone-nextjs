import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const createCreditNoteSchema = z.object({
    tenantId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    reason: z.string().min(3).max(500),
    notes: z.string().max(5000).optional(),
    subtotal: z.number().nonnegative(),
    taxAmount: z.number().nonnegative().default(0),
    totalAmount: z.number().nonnegative(),
    currency: z.string().min(3).max(8).default('USD'),
});

export async function GET(req: NextRequest) {
    try {
        const tenantId = req.nextUrl.searchParams.get('tenantId');
        if (!tenantId) {
            return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
        }
        await requireTenantAccess(tenantId);
        const admin = createAdminSupabaseClientOrThrow();
        const { data, error } = await admin
            .from('credit_notes')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ success: true, creditNotes: data || [] });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to fetch credit notes', req);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = createCreditNoteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
        const { user } = await requireTenantAccess(payload.tenantId);
        const admin = createAdminSupabaseClientOrThrow();

        const { data: lastNote } = await admin
            .from('credit_notes')
            .select('credit_note_number')
            .eq('tenant_id', payload.tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const year = new Date().getUTCFullYear();
        const lastSeq = Number((lastNote?.credit_note_number || '').split('-').pop() || 0);
        const nextSeq = String(lastSeq + 1).padStart(3, '0');
        const creditNoteNumber = `CN-${year}-${nextSeq}`;

        const { data, error } = await admin
            .from('credit_notes')
            .insert({
                tenant_id: payload.tenantId,
                invoice_id: payload.invoiceId,
                credit_note_number: creditNoteNumber,
                reason: payload.reason,
                notes: payload.notes ?? null,
                subtotal: payload.subtotal,
                tax_amount: payload.taxAmount,
                total_amount: payload.totalAmount,
                currency: payload.currency,
                created_by: user.id,
            })
            .select('*')
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, creditNote: data });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to create credit note', req);
    }
}
