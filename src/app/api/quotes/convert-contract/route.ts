import { NextRequest, NextResponse } from 'next/server';
import { convertQuoteToContract } from '@/lib/quotes/convertQuoteToContract';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : undefined;
    const terms = typeof body.terms === 'string' ? body.terms.trim() : undefined;

    if (!quoteId) {
      return NextResponse.json({ error: 'quoteId is required' }, { status: 400 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId, request);

    const result = await convertQuoteToContract(quoteId, tenantId, {
      title,
      terms,
      createdBy: user?.id,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      contractId: result.contractId,
      status: result.status,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Quote to contract conversion failed', request);
  }
}
