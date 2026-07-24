import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { processClaimableTasks } from '@/lib/bonnie/runtime/workerService';
import { reclaimExpiredLeases } from '@/lib/bonnie/runtime/leaseService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const ranAt = new Date().toISOString();
  try {
    const leases = await reclaimExpiredLeases(20);
    const result = await processClaimableTasks(12);

    try {
      const admin = createSupabaseAdminClient();
      await admin.from('automation_cron_logs').insert({
        trigger_type: 'bonnie-runtime-worker',
        status: 'success',
        payload: { leases, result },
        ran_at: ranAt,
      });
    } catch {
      // best-effort
    }

    return NextResponse.json({ success: true, leases, result, timestamp: ranAt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
