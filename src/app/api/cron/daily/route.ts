import { NextRequest, NextResponse } from 'next/server';
import { contractExpirationService } from '@/services/contractExpirationService';
import { paymentService } from '@/services/paymentService';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runUserDigestEmails } from '@/lib/email/runUserDigestEmails';
import { runMorningBriefingEmails } from '@/lib/email/runMorningBriefingEmails';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';

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
        let digest: { attempted: number; sent: number; failed: number } | null = null;
        try {
            digest = await runUserDigestEmails();
        } catch (digestErr) {
            console.error('Daily digest emails:', digestErr);
        }

        let morning: { profilesAttempted: number; emailsSent: number; failed: number } | null = null;
        try {
            morning = await runMorningBriefingEmails();
        } catch (morningErr) {
            console.error('Morning briefing emails:', morningErr);
        }
        console.log(`[Cron] Emails took ${Date.now() - emailStart}ms`);

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
            morning,
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
