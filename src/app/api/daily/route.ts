import { NextRequest, NextResponse } from 'next/server';
import { contractExpirationService } from '@/services/contractExpirationService';
import { paymentService } from '@/services/paymentService';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runUserDigestEmails } from '@/lib/email/runUserDigestEmails';
import { runMorningBriefingEmails } from '@/lib/email/runMorningBriefingEmails';
import { runChaseMorningBriefEmails, runCriticalChaseAlerts } from '@/lib/email/runChaseOwnerEmails';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';
import { scanNoReplyEmails } from '@/lib/email/noReplyEngine';
import { evaluateTenantSlas } from '@/lib/email/slaEngine';
import { generateDailyOperationsSummary } from '@/lib/daily/dailyOperationsEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenantIdParam = req.nextUrl.searchParams.get('tenantId');

  // If user is directly requesting tenant summary via query param
  if (tenantIdParam) {
    try {
      const summary = await generateDailyOperationsSummary(tenantIdParam);
      return NextResponse.json({ success: true, summary });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    console.log('[Daily Cron] System daily operations maintenance triggered');

    // 1. Contract Maintenance
    const contractStart = Date.now();
    const contractResults = await contractExpirationService.performDailyMaintenance();
    console.log(`[Cron] Contracts maintenance took ${Date.now() - contractStart}ms`);

    // 2. Renewable Billing
    const billingStart = Date.now();
    const billingResults = await paymentService.processRecurringBilling();
    console.log(`[Cron] Billing processing took ${Date.now() - billingStart}ms`);

    // 3. Scan No-Reply & Evaluate Communication SLAs
    const commStart = Date.now();
    let noReplyResults: Record<string, unknown> | null = null;
    let slaResults: Record<string, unknown> | null = null;
    try {
      const supabase = createSupabaseAdminClient();
      const { data: tenants } = await supabase.from('tenants').select('id').limit(100);
      if (tenants) {
        for (const t of tenants) {
          await scanNoReplyEmails(t.id).catch(console.error);
          await evaluateTenantSlas(t.id).catch(console.error);
        }
        noReplyResults = { tenantsProcessed: tenants.length };
        slaResults = { tenantsProcessed: tenants.length };
      }
    } catch (commErr) {
      console.error('Communication SLA maintenance error:', commErr);
    }
    console.log(`[Cron] Communication SLA maintenance took ${Date.now() - commStart}ms`);

    // 4. Daily summary & briefing emails
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

    let chaseBrief: { sent: number; skipped: number; failed: number } | null = null;
    let chaseCritical: { sent: number; failed: number } | null = null;
    try {
      chaseBrief = await runChaseMorningBriefEmails();
      chaseCritical = await runCriticalChaseAlerts();
    } catch (chaseEmailErr) {
      console.error('Chase owner emails:', chaseEmailErr);
    }
    console.log(`[Cron] Emails took ${Date.now() - emailStart}ms`);

    // 5. Intelligence Snapshots
    const intelligenceStart = Date.now();
    let intelligence: { tenantId: string; score: number } | null = null;
    const intelligenceTenantId = req.nextUrl.searchParams.get('intelligenceTenantId');
    if (intelligenceTenantId) {
      try {
        const supabase = createSupabaseAdminClient();
        const snapshot = await integratedIntelligenceService.generateSnapshot(
          supabase,
          intelligenceTenantId,
          { persist: true }
        );
        intelligence = { tenantId: intelligenceTenantId, score: snapshot.overallScore };
      } catch (intelligenceErr) {
        console.error('Daily intelligence snapshot:', intelligenceErr);
      }
    }
    console.log(`[Cron] Intelligence snapshot took ${Date.now() - intelligenceStart}ms`);

    // 6. Account & Data Deletions
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
      dataDeletionRequests = await accountDeletionService.processVerifiedDataDeletionRequests();
    } catch (deletionErr) {
      console.error('Scheduled account deletions:', deletionErr);
    }
    console.log(`[Cron] Account deletions took ${Date.now() - deletionStart}ms`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      contracts: contractResults,
      billing: billingResults,
      noReply: noReplyResults,
      sla: slaResults,
      digest,
      morning,
      chaseBrief,
      chaseCritical,
      intelligence,
      accountDeletions,
      dataDeletionRequests,
    });
  } catch (error) {
    console.error('Critical error in daily cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
