import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getPublicInvoicePaymentUrl } from '@/lib/invoices/publicInvoiceAccess';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();
    const url = await getPublicInvoicePaymentUrl(admin, invoiceId, tenantId, req.nextUrl.origin);

    return NextResponse.json({ success: true, url });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to build public invoice link', req);
  }
}
