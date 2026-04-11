import { NextRequest, NextResponse } from 'next/server';
import { contractExpirationService } from '@/services/contractExpirationService';
import { paymentService } from '@/services/paymentService';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        console.log('Daily cron job triggered');

        // 1. Contract Maintenance
        const contractResults = await contractExpirationService.performDailyMaintenance();

        // 2. Renewable Billing
        const billingResults = await paymentService.processRecurringBilling();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            contracts: contractResults,
            billing: billingResults
        });

    } catch (error) {
        console.error('Critical error in daily cron:', error);
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 });
    }
}
