import { NextRequest, NextResponse } from 'next/server';
import { contractExpirationService } from '@/services/contractExpirationService';
import { paymentService } from '@/services/paymentService';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runNotificationDigests } from '@/lib/email/notificationDigestEngine';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';
import {
    runChaseMorningBriefEmails,
    runCriticalChaseAlerts,
    runChaseEndOfDayEmails,
} from '@/lib/email/runChaseOwnerEmails';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        console.log('Daily cron job triggered');

        // 1. Contract Maintenance
        const contractStart = Date.now();
        const contractResults = await contractExpirationService.performDailyMaintenance();
        console.log(`[Cron] Contracts maintenance took ${Date.now() - contractStart}ms`);

        // 2. Renewable Billing
        const billingStart = Date.now();
        const billingResults = await paymentService.processRecurringBilling();
        console.log(`[Cron] Billing processing took ${Date.now() - billingStart}ms`);

        // 3. Optional daily summary emails
        const emailStart = Date.now();
        let digest: Awaited<ReturnType<typeof runNotificationDigests>> | null = null;
        try {
            digest = await runNotificationDigests();
        } catch (digestErr) {
            console.error('Daily digest emails:', digestErr);
        }
        console.log(`[Cron] Emails took ${Date.now() - emailStart}ms`);

        // 4. Owner chase notifications. Morning/end-of-day chase briefs are merged into the
        // consolidated owner summary (notification-digests cron, hourly, owner-local 18:00 by
        // default). Standalone sends are opt-in only to keep the one-summary-per-day rule.
        const standaloneChaseEmails = process.env.CHASER_STANDALONE_OWNER_EMAILS === 'true';
        const chase = {
            morning: standaloneChaseEmails
                ? await runChaseMorningBriefEmails().catch((error) => ({ error: String(error) }))
                : { skipped: 'merged_into_daily_summary' },
            critical: await runCriticalChaseAlerts().catch((error) => ({ error: String(error) })),
            endOfDay: standaloneChaseEmails
                ? await runChaseEndOfDayEmails().catch((error) => ({ error: String(error) }))
                : { skipped: 'merged_into_daily_summary' },
        };

        const intelligenceStart = Date.now();
        let intelligence: { tenantId: string; score: number } | null = null;
        const intelligenceTenantId = req.nextUrl.searchParams.get('intelligenceTenantId');
        if (intelligenceTenantId) {
            try {
                const supabase = createSupabaseAdminClient();
                const snapshot = await integratedIntelligenceService.generateSnapshot(supabase, intelligenceTenantId, { persist: true });
                intelligence = { tenantId: intelligenceTenantId, score: snapshot.overallScore };
            } catch (intelligenceErr) {
                console.error('Daily intelligence snapshot:', intelligenceErr);
            }
        }
        console.log(`[Cron] Intelligence snapshot took ${Date.now() - intelligenceStart}ms`);

        const deletionStart = Date.now();
        let accountDeletions: { processed: number; failed: string[] } | null = null;
        let dataDeletionRequests: {
            processed: number;
            scheduled: number;
            failed: string[];
        } | null = null;
        try {
            const { accountDeletionService } = await import('@/services/accountDeletionService');
            accountDeletions = await accountDeletionService.processScheduledDeletions();
            dataDeletionRequests =
                await accountDeletionService.processVerifiedDataDeletionRequests();
        } catch (deletionErr) {
            console.error('Scheduled account deletions:', deletionErr);
        }
        console.log(`[Cron] Account deletions took ${Date.now() - deletionStart}ms`);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            contracts: contractResults,
            billing: billingResults,
            digest,
            chase,
            intelligence,
            accountDeletions,
            dataDeletionRequests,
        });

    } catch (error) {
        console.error('Critical error in daily cron:', error);
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 });
    }
}
