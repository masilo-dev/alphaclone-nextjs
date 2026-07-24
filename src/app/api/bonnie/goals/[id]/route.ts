import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getGoalWithSubtasks, runCognitiveLoop } from '@/lib/bonnie/os';
import type { GoalStatus } from '@/lib/bonnie/os/goalEngine';

export const dynamic = 'force-dynamic';

/**
 * Single Bonnie goal + subtasks.
 * GET    ?tenantId= — detail
 * PATCH  { tenantId, status?, cancel?, resume?, chase? }
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: 'goal id is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const detail = await getGoalWithSubtasks(id, tenantId);
    if (!detail) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...detail });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(context.params);
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: 'goal id is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();
    const detail = await getGoalWithSubtasks(id, tenantId);
    if (!detail) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    if (body.chase === true) {
      const cognitive = await runCognitiveLoop({
        tenantId,
        userId: user.id,
        goal: detail.goal.description || detail.goal.title,
        triggerType: 'continuous',
        goalId: id,
        conversationId: detail.goal.conversation_id || undefined,
        workflowId: detail.goal.workflow_id || undefined,
        executeActions: body.executeActions !== false,
      });
      const refreshed = await getGoalWithSubtasks(id, tenantId);
      return NextResponse.json({
        success: true,
        cognitive,
        ...refreshed,
      });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.cancel === true) {
      patch.status = 'cancelled' satisfies GoalStatus;
      patch.completed_at = new Date().toISOString();
      patch.waiting_for = null;
      patch.blocker_reason = 'Cancelled by user';
    } else if (body.resume === true) {
      patch.status = 'active' satisfies GoalStatus;
      patch.waiting_for = null;
      patch.blocker_reason = null;
      patch.completed_at = null;
    } else if (body.status) {
      const allowed: GoalStatus[] = [
        'draft',
        'active',
        'blocked',
        'awaiting_approval',
        'monitoring',
        'completed',
        'failed',
        'cancelled',
      ];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      patch.status = body.status;
      if (body.status === 'completed' || body.status === 'cancelled' || body.status === 'failed') {
        patch.completed_at = new Date().toISOString();
        patch.progress_pct = body.status === 'completed' ? 100 : detail.goal.progress_pct;
      }
    }

    if (body.priority != null) patch.priority = Number(body.priority);
    if (body.blocker_reason !== undefined) patch.blocker_reason = body.blocker_reason;
    if (body.waiting_for !== undefined) patch.waiting_for = body.waiting_for;

    const { data, error } = await admin
      .from('bonnie_goals')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;

    const subtasks = detail.subtasks;
    return NextResponse.json({ success: true, goal: data, subtasks });
  } catch (err: unknown) {
    return routeErrorResponse(err);
  }
}
