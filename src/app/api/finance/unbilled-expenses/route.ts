import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { listUnbilledExpenses } from '@/services/finance/expenseInvoicingService';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    const clientId = req.nextUrl.searchParams.get('clientId')?.trim();
    if (!tenantId || !clientId) {
      return NextResponse.json({ error: 'tenantId and clientId are required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const expenses = await listUnbilledExpenses(admin, tenantId, clientId);

    return NextResponse.json({ success: true, expenses });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load unbilled expenses', req);
  }
}
