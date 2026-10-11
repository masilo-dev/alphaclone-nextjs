import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { BoardType } from '@/lib/kanban/boardModel';
import { getBoardDefinition } from '@/lib/kanban/boardDefinitions';
import { calculateKanbanFlowMetrics } from '@/lib/kanban/flowMetricsEngine';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);

    const { searchParams } = new URL(req.url);
    const boardType = (searchParams.get('boardType') || 'crm_deals') as BoardType;
    const windowDays = Number(searchParams.get('windowDays') || 30);

    const boardDef = getBoardDefinition(boardType);
    const admin = createSupabaseAdminClient();

    // 1. Fetch transition logs within window
    const windowCutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: transitions, error: logError } = await admin
      .from('board_transition_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('board_type', boardType)
      .gte('created_at', windowCutoff)
      .order('created_at', { ascending: true });

    if (logError) throw logError;

    // 2. Fetch active cards from primary table
    const tableName = boardType === 'workspace_tasks' || boardType === 'project_tasks'
      ? 'tasks'
      : (boardType === 'crm_deals' ? 'deals' : 'leads');

    const stageField = tableName === 'tasks' ? 'status' : 'stage';

    const { data: activeCards, error: cardError } = await admin
      .from(tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('archived', false);

    if (cardError) throw cardError;

    const normalizedCards = (activeCards || []).map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      title: row.name || row.title || row.business_name || 'Untitled',
      stage: row[stageField] || 'lead',
      owner_id: row.owner_id || row.assigned_to || null,
      entered_column_at: row.entered_column_at || row.updated_at || row.created_at,
      is_blocked: Boolean(row.is_blocked),
      blocked_reason: row.blocked_reason || null,
      blocked_since: row.blocked_since || null,
      unblock_owner_id: row.unblock_owner_id || null,
      class_of_service: row.class_of_service || 'standard',
      next_action: row.next_action || row.next_step || null,
      next_action_date: row.next_action_date || null,
      archived: Boolean(row.archived),
      archived_at: row.archived_at || null,
      archived_by: row.archived_by || null,
      value: row.value !== undefined ? Number(row.value) : null,
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const metrics = calculateKanbanFlowMetrics({
      tenantId,
      boardDef,
      transitions: (transitions || []) as any,
      activeCards: normalizedCards,
      windowDays,
    });

    return NextResponse.json({ metrics });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to calculate flow metrics', req);
  }
}
