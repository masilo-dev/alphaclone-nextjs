import { NextRequest, NextResponse } from 'next/server';
import { verifyChaseActionToken } from '@/lib/chaser/chaseActionTokens';
import { transitionChaseState } from '@/lib/chaser/chaseInstanceService';
import { approveAndExecuteChase } from '@/lib/chaser/chaseExecutorService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const parsed = verifyChaseActionToken(token);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  try {
    if (parsed.action === 'snooze') {
      const until = new Date(Date.now() + 24 * 3600_000).toISOString();
      await transitionChaseState(parsed.tenantId, parsed.chaseId, {
        state: 'SNOOZED',
        snoozedUntil: until,
        evidence: { snoozed_via: 'email_action', until },
      });
      return NextResponse.redirect(
        new URL(`/dashboard?tenantId=${parsed.tenantId}&chase=snoozed`, req.nextUrl.origin),
      );
    }

    if (parsed.action === 'stop') {
      await transitionChaseState(parsed.tenantId, parsed.chaseId, {
        state: 'CANCELLED',
        terminalOutcome: 'stopped_by_owner',
        evidence: { stopped_via: 'email_action' },
      });
      return NextResponse.redirect(
        new URL(`/dashboard?tenantId=${parsed.tenantId}&chase=stopped`, req.nextUrl.origin),
      );
    }

    if (parsed.action === 'approve') {
      const result = await approveAndExecuteChase(
        parsed.tenantId,
        parsed.chaseId,
        parsed.ownerUserId,
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Approval failed' }, { status: 400 });
      }
      return NextResponse.redirect(
        new URL(`/dashboard?tenantId=${parsed.tenantId}&chase=approved`, req.nextUrl.origin),
      );
    }

    return NextResponse.redirect(
      new URL(`/dashboard?tenantId=${parsed.tenantId}&chase=${parsed.chaseId}`, req.nextUrl.origin),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 },
    );
  }
}
