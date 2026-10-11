import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { BoardTransitionService } from '@/lib/kanban/boardTransitionService';
import { BoardArchiveService } from '@/lib/kanban/boardArchiveService';
import { BoardType } from '@/lib/kanban/boardModel';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const transitionSchema = z.object({
  boardType: z.enum(['crm_deals', 'crm_leads', 'workspace_tasks', 'project_tasks', 'onboarding']),
  cardId: z.string().uuid(),
  targetState: z.string().min(1),
  reason: z.string().optional(),
  overrideWip: z.boolean().optional(),
  overrideReason: z.string().optional(),
  cardUpdates: z.object({
    nextAction: z.string().optional(),
    nextActionDate: z.string().optional(),
    value: z.number().optional(),
    notes: z.string().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().optional(),
    unblockOwnerId: z.string().uuid().optional(),
    classOfService: z.enum(['expedite', 'fixed_date', 'standard', 'intangible']).optional(),
    contractId: z.string().optional(),
    quoteId: z.string().optional(),
    checklistComplete: z.boolean().optional(),
  }).optional(),
});

const archiveSchema = z.object({
  action: z.enum(['archive', 'restore']),
  boardType: z.enum(['crm_deals', 'crm_leads', 'workspace_tasks', 'project_tasks', 'onboarding']),
  cardId: z.string().uuid(),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await context.params;
    const { user, membership } = await requireTenantAccess(tenantId, req);

    const body = await req.json().catch(() => ({}));

    // Check if this is an archive or restore request
    if (body.action === 'archive' || body.action === 'restore') {
      const parsedArchive = archiveSchema.safeParse(body);
      if (!parsedArchive.success) {
        return NextResponse.json({ error: 'Invalid archival request', details: parsedArchive.error.flatten() }, { status: 400 });
      }

      if (parsedArchive.data.action === 'archive') {
        const result = await BoardArchiveService.archiveCard({
          tenantId,
          boardType: parsedArchive.data.boardType as BoardType,
          cardId: parsedArchive.data.cardId,
          actorId: user.id,
          reason: parsedArchive.data.reason,
        });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ success: true, archived: true });
      } else {
        const result = await BoardArchiveService.restoreCard({
          tenantId,
          boardType: parsedArchive.data.boardType as BoardType,
          cardId: parsedArchive.data.cardId,
          actorId: user.id,
        });
        if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ success: true, restored: true, restoredStage: result.restoredStage });
      }
    }

    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid transition payload', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await BoardTransitionService.executeTransition({
      tenantId,
      boardType: parsed.data.boardType as BoardType,
      cardId: parsed.data.cardId,
      targetState: parsed.data.targetState,
      actorId: user.id,
      userRole: membership.role,
      reason: parsed.data.reason,
      overrideWip: parsed.data.overrideWip,
      overrideReason: parsed.data.overrideReason,
      cardUpdates: parsed.data.cardUpdates,
    });

    if (!result.success) {
      const status = result.errorCode === 'WIP_LIMIT_EXCEEDED' || result.errorCode === 'INVALID_TRANSITION' || result.errorCode === 'TERMINAL_STATE_LOCKED'
        ? 409
        : 400;
      return NextResponse.json({ error: result.error, errorCode: result.errorCode }, { status });
    }

    return NextResponse.json({ ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to transition card', req);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);

    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get('cardId');
    const boardType = searchParams.get('boardType');

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('board_transition_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (cardId) query = query.eq('card_id', cardId);
    if (boardType) query = query.eq('board_type', boardType);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ transitions: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch transition logs', req);
  }
}
