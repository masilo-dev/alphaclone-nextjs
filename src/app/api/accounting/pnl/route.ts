
import { NextRequest, NextResponse } from 'next/server';
import { generatePnLStatement } from '@/lib/accounting/pnl';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'monthly') as 'monthly' | 'quarterly' | 'yearly';
    const fromDate = searchParams.get('from_date') || undefined;
    const toDate = searchParams.get('to_date') || undefined;
    const tenantId = z.string().uuid().parse(searchParams.get('tenantId'));
    await requireTenantAccess(tenantId);

    const statement = await generatePnLStatement(
      tenantId,
      period,
      fromDate,
      toDate
    );

    return NextResponse.json(statement);
  } catch (err: unknown) {
    console.error('[PnL API] Error:', err);
    return routeErrorResponse(err, 'Failed to generate P&L statement', req);
  }
}
