import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { attachExpensesToInvoice } from '@/services/finance/expenseInvoicingService';

const schema = z.object({
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  expenseIds: z.array(z.string().uuid()).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    await requireTenantAccess(parsed.data.tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const result = await attachExpensesToInvoice(
      admin,
      parsed.data.tenantId,
      parsed.data.invoiceId,
      parsed.data.expenseIds
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to attach expenses to invoice', req);
  }
}
