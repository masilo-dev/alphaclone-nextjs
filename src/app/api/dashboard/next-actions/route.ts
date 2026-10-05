import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  deriveTenantNextBestActions,
  nbaToChaseHints,
} from '@/lib/execution/nextBestActionEngine';

export const dynamic = 'force-dynamic';

/**
 * Owner attention / next-best-action feed (deterministic rules).
 * GET /api/dashboard/next-actions?tenantId=
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, req);
    const { deriveCustomerSuccessActions } = await import(
      '@/lib/execution/customerSuccessAttention'
    );
    const [actionsRaw, cs] = await Promise.all([
      deriveTenantNextBestActions(tenantId, 50),
      deriveCustomerSuccessActions(tenantId).catch(() => []),
    ]);
    const seen = new Set(actionsRaw.map((a) => `${a.object_type}:${a.object_id}:${a.outstanding_action}`));
    const actions = [...actionsRaw];
    for (const item of cs) {
      const key = `${item.object_type}:${item.object_id}:${item.outstanding_action}`;
      if (!seen.has(key)) {
        seen.add(key);
        actions.push(item);
      }
    }
    const byBucket = {
      needs_approval: actions.filter((a) => a.approval_requirement === 'always'),
      needs_attention: actions.filter((a) => a.urgency === 'critical' || a.urgency === 'high'),
      waiting_externally: actions.filter((a) =>
        ['unsigned', 'awaiting_payment', 'awaiting_response', 'viewed_no_response'].includes(
          String(a.blocking_condition || '')
        )
      ),
      scheduled: [] as typeof actions,
      failed: [] as typeof actions,
      completed_recently: [] as typeof actions,
    };

    return NextResponse.json({
      success: true,
      tenant_id: tenantId,
      actions,
      buckets: byBucket,
      chase_hints: nbaToChaseHints(actions),
      generated_at: new Date().toISOString(),
      engine: 'deterministic-nba-v1',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Next actions could not be derived', req);
  }
}
