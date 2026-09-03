import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { processLeadDiscoveryBatch } from '@/workers/lead-discovery-worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob(
    'lead-discovery-worker',
    async () => {
      try {
        const result = await processLeadDiscoveryBatch({
          workerId: `lead-cron-${process.pid}-${Date.now()}`,
          claimLimit: 3,
        });

        return NextResponse.json({
          success: result.results.every((row) => row.ok),
          ...result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Lead discovery worker failed',
          },
          { status: 500 }
        );
      }
    },
    { maxDurationMs: 25_000 }
  );
}
