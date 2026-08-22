import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runDailyBusinessSummaryEmails } from '@/lib/email/runDailyBusinessSummaryEmails';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        console.log('[Cron] Triggering Automatic Daily Business Summary Emails');
        const results = await runDailyBusinessSummaryEmails();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            results,
        });
    } catch (error) {
        console.error('Critical error in daily business summary cron:', error);
        return NextResponse.json(
            {
                success: false,
                error: String(error),
            },
            { status: 500 }
        );
    }
}
