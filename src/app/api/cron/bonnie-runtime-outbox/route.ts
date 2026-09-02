import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { publishOutboxBatch } from '@/lib/bonnie/runtime/outboxService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob('bonnie-runtime-outbox', async () => {
    try {
      const result = await publishOutboxBatch(40);
      return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  });
}
