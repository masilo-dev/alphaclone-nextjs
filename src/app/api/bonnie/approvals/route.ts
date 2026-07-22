import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieApprovalPreview = {
  id: string;
  toolName: string;
  riskLevel: string;
  reason: string;
  status: string;
  createdAt: string;
  preview: { target?: string; draft?: string };
  payload: Record<string, unknown>;
  editHistory?: Array<{ timestamp: string; args: Record<string, unknown> }>;
  workflowId?: string | null;
  conversationId?: string | null;
};

function buildPreviewFromPayload(payload: Record<string, unknown>) {
  const args = (payload.args || {}) as Record<string, unknown>;
  const target =
    args.to ||
    args.recipient ||
    args.email ||
    args.phone ||
    args.client_id ||
    undefined;
  const draft =
    args.body ||
    args.message ||
    args.content ||
    args.text ||
    args.subject ||
    args.html ||
    undefined;

  return {
    target: target ? String(target) : undefined,
    draft: draft ? String(draft).slice(0, 2000) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(new URL(request.url).searchParams.get('tenantId') || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, request);

    const { data, error } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const bonnieApprovals: BonnieApprovalPreview[] = (data || [])
      .filter((row: { payload?: Record<string, unknown>; action_key?: string; source?: string; workflow_id?: string | null }) => {
        const payload = (row.payload || {}) as Record<string, unknown>;
        const actionKey = String(row.action_key || '');
        const source = String(row.source || payload.source || '');
        // Surface Bonnie, MCP, and autonomous-runner pending actions in Approval Center
        return (
          source === 'bonnie' ||
          source === 'autonomous_runner' ||
          actionKey.startsWith('bonnie:') ||
          actionKey.startsWith('mcp:') ||
          !!row.workflow_id ||
          payload.source === 'bonnie'
        );
      })
      .map((row: any) => {
        const payload = (row.payload || {}) as Record<string, unknown>;
        const toolName =
          String(payload.tool_name || '') ||
          String(row.action_key || '').replace(/^(bonnie:|mcp:)/, '');
        return {
          id: row.id,
          toolName,
          riskLevel: row.risk_level,
          reason: row.reason,
          status: row.status,
          createdAt: row.created_at,
          preview: buildPreviewFromPayload(payload),
          payload,
          editHistory: Array.isArray(row.edit_history) ? row.edit_history : [],
          workflowId: row.workflow_id ?? null,
          conversationId: row.conversation_id ?? null,
        };
      });

    return NextResponse.json({
      success: true,
      approvals: bonnieApprovals,
      pendingCount: bonnieApprovals.length,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load Bonnie approvals');
  }
}

/**
 * PATCH /api/bonnie/approvals
 * Inline argument editing: merges args into payload and records the original
 * in edit_history so the full edit trail is preserved for audit.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, approvalId, args } = body;

    if (!tenantId || !approvalId || !args || typeof args !== 'object') {
      return NextResponse.json({ error: 'tenantId, approvalId, and args are required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId, request);

    const { data: existing, error: fetchError } = await admin
      .from('autonomous_runner_approvals')
      .select('payload, edit_history')
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Pending approval not found' }, { status: 404 });
    }

    const payload = (existing.payload || {}) as Record<string, unknown>;
    const editHistory = Array.isArray(existing.edit_history) ? existing.edit_history : [];

    // Snapshot the current args into edit history before overwriting
    const currentArgs = (payload.args || {}) as Record<string, unknown>;
    const newEditEntry = {
      timestamp: new Date().toISOString(),
      previous_args: currentArgs,
      new_args: args,
    };

    const mergedPayload = {
      ...payload,
      args: { ...currentArgs, ...args },
    };

    const { data, error } = await admin
      .from('autonomous_runner_approvals')
      .update({
        payload: mergedPayload,
        edit_history: [...editHistory, newEditEntry],
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      approval: data,
      preview: buildPreviewFromPayload(mergedPayload),
      editCount: editHistory.length + 1,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update approval');
  }
}
