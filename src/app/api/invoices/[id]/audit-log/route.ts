import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query param required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // Verify invoice belongs to tenant
    const { data: invoice, error: invoiceError } = await admin
      .from('business_invoices')
      .select('id')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const { data: logs, error: logsError } = await admin
      .from('invoice_audit_log')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (logsError) throw logsError;

    return NextResponse.json({ success: true, data: logs ?? [] });
  } catch (err) {
    return routeErrorResponse(err, 'Failed to fetch audit log', req);
  }
}
