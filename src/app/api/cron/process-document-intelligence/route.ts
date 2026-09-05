import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { processQueuedDocumentIntelligence } from '@/services/documentIntelligenceService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  return withCronJob('process-document-intelligence', async () => {
    const limit = Math.min(
      8,
      Math.max(1, Number(new URL(request.url).searchParams.get('limit') || 4))
    );
    const results = await processQueuedDocumentIntelligence(limit);
    return NextResponse.json({ processed: results.length, results });
  }, { maxDurationMs: 25_000, lockTtlSec: 180 });
}
