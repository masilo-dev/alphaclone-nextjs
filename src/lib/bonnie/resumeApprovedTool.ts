import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolExecutor';

type ApprovalPayload = {
  source?: string;
  tool_name?: string;
  user_id?: string;
  args?: Record<string, unknown>;
  risk_class?: string;
  agent_mode?: string;
};

export async function resumeApprovedTool(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
}): Promise<{ success: boolean; result?: BonnieToolResult; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: approval, error: fetchError } = await admin
    .from('autonomous_runner_approvals')
    .select('*')
    .eq('id', params.approvalId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (fetchError || !approval) {
    return { success: false, error: fetchError?.message || 'Approval not found' };
  }

  if (approval.status !== 'pending') {
    return {
      success: false,
      error: `Approval is already ${approval.status}. Refresh to see the latest workflow state.`,
    };
  }

  const payload = (approval.payload || {}) as ApprovalPayload;
  const toolName =
    payload.tool_name ||
    String(approval.action_key || '').replace(/^(bonnie|mcp|playbook):/, '');

  const execUserId = params.userId || String(payload.user_id || '');
  if (!toolName || !execUserId) {
    return { success: false, error: 'Approval has no executable tool payload or user context' };
  }

  const policySource =
    payload.source === 'mcp' || payload.source === 'playbook' ? payload.source : 'bonnie';

  const { data: claimed, error: claimError } = await admin.from('autonomous_runner_approvals')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', params.approvalId).eq('tenant_id', params.tenantId).eq('status', 'pending')
    .select('id').maybeSingle();
  if (claimError || !claimed) return { success: false, error: claimError?.message || 'Approval is already executing' };

  const result = await executeSingleBonnieTool({
    tenantId: params.tenantId,
    userId: execUserId,
    tool: toolName,
    args: payload.args || {},
    skipPolicy: true,
    policySource,
  });

  const finalStatus = result.success ? 'executed' : 'approved';
  const { error: persistenceError } = await admin
    .from('autonomous_runner_approvals')
    .update({
      status: result.success ? 'executed' : finalStatus,
      updated_at: new Date().toISOString(),
      payload: {
        ...payload,
        execution_result: {
          success: result.success,
          summary: result.summary,
          details: result.details,
          result: result.executionResult,
          executed_at: new Date().toISOString(),
          executed_by: params.userId,
        },
      },
    })
    .eq('id', params.approvalId)
    .eq('tenant_id', params.tenantId);

  if (persistenceError) return { success: false, result, error: 'Approval result could not be persisted. Review the execution receipt before retrying.' };
  return { success: result.success, result, error: result.success ? undefined : result.summary };
}
