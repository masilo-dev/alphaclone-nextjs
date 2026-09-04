import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { transitionChaseState, getChaseInstanceById } from '@/lib/chaser/chaseInstanceService';
import { approveAndExecuteChase, executeChaseInstance } from '@/lib/chaser/chaseExecutorService';

export const dynamic = 'force-dynamic';

type ChaseAction = 'approve' | 'snooze' | 'stop' | 'execute';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = String(body.tenantId || '');
    const chaseId = String(body.chaseId || '');
    const action = String(body.action || '') as ChaseAction;
    const userId = String(body.userId || '');

    if (!tenantId || !chaseId || !action) {
      return NextResponse.json({ error: 'tenantId, chaseId, and action are required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId, req);
    const actorId = userId || user.id;

    if (action === 'snooze') {
      const hours = Number(body.hours || 24);
      const until = new Date(Date.now() + hours * 3600_000).toISOString();
      const result = await transitionChaseState(tenantId, chaseId, {
        state: 'SNOOZED',
        snoozedUntil: until,
        evidence: { snoozed_by: actorId, until, via: 'dashboard' },
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true, action, snoozed_until: until });
    }

    if (action === 'stop') {
      const result = await transitionChaseState(tenantId, chaseId, {
        state: 'CANCELLED',
        terminalOutcome: 'stopped_by_owner',
        evidence: { stopped_by: actorId, via: 'dashboard' },
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true, action });
    }

    if (action === 'approve') {
      const result = await approveAndExecuteChase(tenantId, chaseId, actorId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true, action, outcome: result.outcome });
    }

    if (action === 'execute') {
      const { data: chase, error } = await getChaseInstanceById(tenantId, chaseId);
      if (error || !chase) {
        return NextResponse.json({ error: error || 'Chase not found' }, { status: 404 });
      }
      const result = await executeChaseInstance(chase);
      return NextResponse.json({ ok: true, action, ...result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return routeErrorResponse(error, 'Chase action failed');
  }
}
