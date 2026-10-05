import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { reconcileUnknownExternalActions } from '@/lib/execution/reconcileUnknownExternalActions';

export const dynamic = 'force-dynamic';

/**
 * Reconciles external_actions stuck in unknown_execution_state without re-executing business writes.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const result = await reconcileUnknownExternalActions(40);
  return NextResponse.json({ ok: true, ...result });
}
