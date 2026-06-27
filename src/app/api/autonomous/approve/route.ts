import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { approveAndResumeBonnieMission } from '@/lib/bonnie/resumeBonnieMission';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, approvalId, status, resumeMission = true } = body;

    if (!tenantId || !approvalId || !status) {
      return NextResponse.json({ error: 'Missing tenantId, approvalId, or status' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from('autonomous_runner_approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    if (status === 'rejected') {
      const { data, error } = await admin
        .from('autonomous_runner_approvals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', approvalId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, approval: data, execution: null, continuation: null });
    }

    const payload = (existing.payload || {}) as Record<string, unknown>;
    const instruction = typeof payload.instruction === 'string' ? payload.instruction : undefined;

    const { execution, continuation } = await approveAndResumeBonnieMission({
      tenantId,
      userId: user.id,
      approvalId,
      instruction: resumeMission ? instruction : undefined,
    });

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
          }
        : null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update approval status');
  }
}
