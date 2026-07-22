import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { approveAndResumeBonnieMission } from '@/lib/bonnie/resumeBonnieMission';
import { canApproveHighRisk } from '@/lib/bonnie/bonnieRiskPolicy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, approvalId, status, resumeMission = true, editedArgs } = body;

    if (!tenantId || !approvalId || !status) {
      return NextResponse.json({ error: 'Missing tenantId, approvalId, or status' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { user, admin } = await requireTenantAccess(tenantId);

    const { data: existing } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Approval is already ${existing.status}. Refresh to see the latest workflow state.`,
          code: 'STALE_APPROVAL',
        },
        { status: 409 }
      );
    }

    // ── Risk-based role gate ──────────────────────────────────────────────────
    // If the approval is high-risk, only tenant admins can approve
    const riskLevel = String(existing.risk_level || 'medium').toLowerCase();
    if (status === 'approved' && (riskLevel === 'high' || riskLevel === 'critical')) {
      // Look up the user's role in this tenant
      const { data: tenantUser } = await admin
        .from('tenant_users')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!canApproveHighRisk(tenantUser?.role)) {
        return NextResponse.json(
          {
            error: 'Only tenant admins can approve high-risk actions. Contact your workspace owner.',
            code: 'INSUFFICIENT_ROLE',
            requiredRole: 'tenant_admin',
            userRole: tenantUser?.role ?? null,
          },
          { status: 403 }
        );
      }
    }

    // ── Merge edited args into payload (if provided) ──────────────────────────
    let payload = (existing.payload || {}) as Record<string, unknown>;
    let editHistory = Array.isArray(existing.edit_history) ? existing.edit_history : [];

    if (editedArgs && typeof editedArgs === 'object' && Object.keys(editedArgs).length > 0) {
      const currentArgs = (payload.args || {}) as Record<string, unknown>;
      editHistory = [
        ...editHistory,
        {
          timestamp: new Date().toISOString(),
          action: 'approved_with_edits',
          approved_by: user.id,
          previous_args: currentArgs,
          new_args: editedArgs,
        },
      ];
      payload = {
        ...payload,
        args: { ...currentArgs, ...editedArgs },
      };
      // Persist the merged payload before executing
      await admin
        .from('autonomous_runner_approvals')
        .update({
          payload,
          edit_history: editHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .eq('tenant_id', tenantId);
    }

    // ── Rejection ─────────────────────────────────────────────────────────────
    if (status === 'rejected') {
      const rejectionHistory = [
        ...editHistory,
        {
          timestamp: new Date().toISOString(),
          action: 'rejected',
          rejected_by: user.id,
        },
      ];
      const { data, error } = await admin
        .from('autonomous_runner_approvals')
        .update({
          status: 'rejected',
          edit_history: rejectionHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, approval: data, execution: null, continuation: null });
    }

    // ── Approval + mission resumption ─────────────────────────────────────────
    const instruction = typeof payload.instruction === 'string' ? payload.instruction : undefined;

    const { execution, continuation } = await approveAndResumeBonnieMission({
      tenantId,
      userId: user.id,
      approvalId,
      instruction: resumeMission ? instruction : undefined,
    });

    // Record the approval action in edit history
    await admin
      .from('autonomous_runner_approvals')
      .update({
        edit_history: [
          ...editHistory,
          {
            timestamp: new Date().toISOString(),
            action: 'approved',
            approved_by: user.id,
          },
        ],
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('tenant_id', tenantId);

    const { data } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .single();

    const args = (payload.args || {}) as Record<string, unknown>;
    const toolName =
      String(payload.tool_name || '') ||
      String(data?.action_key || '').replace(/^(bonnie|mcp|playbook):/, '');

    return NextResponse.json({
      success: true,
      approval: data,
      toolName,
      preview: {
        target: args.to || args.recipient || args.email || args.client_id || undefined,
        draft: args.body || args.message || args.content || args.text || undefined,
      },
      execution: execution
        ? {
            success: execution.success,
            result: execution.result,
            error: execution.error,
          }
        : null,
      continuation: continuation?.continued
        ? {
            response: continuation.response,
            toolResults: continuation.toolResults,
            executionStatus: continuation.executionStatus,
          }
        : null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update approval status');
  }
}
