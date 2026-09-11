import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { accountDeletionService } from '@/services/accountDeletionService';
import { runInactivityReengagementEmails } from '@/lib/email/runInactivityReengagementEmails';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const scheduled = await accountDeletionService.processScheduledDeletions();
    const verifiedRequests = await accountDeletionService.processVerifiedDataDeletionRequests();
    const inactive = await accountDeletionService.processInactiveAccounts();
    const reengagement = await runInactivityReengagementEmails();

    return NextResponse.json({
      success: inactive.failed.length === 0,
      scheduled,
      verifiedRequests,
      inactive,
      reengagement,
      policy: {
        disableAfterDays: 60,
        purgeDisabledAfterDays: 6,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/account-lifecycle] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Account lifecycle processing failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
