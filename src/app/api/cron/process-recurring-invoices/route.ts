import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { denyIfCronMemoryPressure } from '@/lib/cron/cronMemoryGuard';
import { executeRecurringInvoicesDirect } from '@/lib/cron/directCronExecutors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  const memoryDenied = denyIfCronMemoryPressure('process-recurring-invoices');
  if (memoryDenied) return memoryDenied;

  try {
    const result = await executeRecurringInvoicesDirect();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/process-recurring-invoices] failed:', error);
    return NextResponse.json({ success: false, error: 'Cron execution failed' }, { status: 500 });
  }
}
