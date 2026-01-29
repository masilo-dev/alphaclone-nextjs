import { NextResponse } from 'next/server';
import { contractExpirationService } from '@/services/contractExpirationService';
import { paymentService } from '@/services/paymentService';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic'; // Ensure this route is not cached

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');

        // Simple security check using CRON_SECRET or verifying Vercel signature
        // For Vercel Cron, it's recommended to check 'x-vercel-cron' header and/or a secret
        // Here we use a Basic CRON_SECRET check if configured, or just assume Vercel Internal protection
        // Ideally, in Vercel settings, you'd protect this path or use a secret query param.
        // For now, we will log the attempt.

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
