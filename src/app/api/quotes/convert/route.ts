import { NextRequest, NextResponse } from 'next/server';
import { convertQuoteToInvoice } from '@/lib/quotes/convertQuoteToInvoice';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';

    if (!quoteId) {
      return NextResponse.json({ error: 'quoteId is required' }, { status: 400 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const result = await convertQuoteToInvoice(quoteId, tenantId, {
      autoSend: Boolean(body.autoSend),
      origin: request.nextUrl.origin,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      invoiceId: result.invoiceId,
      publicToken: result.publicToken,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Quote conversion failed');
  }
}
