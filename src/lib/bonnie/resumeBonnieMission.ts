import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runBonnieAgent } from '@/lib/bonnie/bonnieAgent';
import { resumeApprovedTool } from '@/lib/bonnie/resumeApprovedTool';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';
import type { BonnieModuleId } from '@/lib/bonnie/bonnieToolCatalog';

async function resolveWorkflowForApproval(params: {
  tenantId: string;
  approvalId: string;
  workflowId?: string | null;
}) {
  const admin = createSupabaseAdminClient();

  if (params.workflowId) {
    const { data } = await admin
      .from('bonnie_workflows')
      .select('*')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.workflowId)
      .maybeSingle();
    if (data) return data;
  }

  const { data: byBlocking } = await admin
    .from('bonnie_workflows')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .eq('blocking_approval_id', params.approvalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return byBlocking || null;
}

async function updateWorkflowStatus(
  tenantId: string,
  workflowId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('bonnie_workflows')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', workflowId);
}

export async function resumeBonnieMissionAfterApproval(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
  instruction?: string;
  toolName?: string;
  toolResult?: BonnieToolResult;
  workflowId?: string | null;
}): Promise<{
  continued: boolean;
  response?: string;
  toolResults?: BonnieToolResult[];
  executionStatus?: 'executed' | 'queued_for_approval' | 'read_only_answer' | 'planning_failed' | 'provider_blocked';
}> {
  const instruction = params.instruction?.trim();
  if (!instruction) {
    return { continued: false };
  }

  const workflow = await resolveWorkflowForApproval({
    tenantId: params.tenantId,
    approvalId: params.approvalId,
    workflowId: params.workflowId,
  });

  const toolSummary = params.toolResult?.summary || 'completed';
  const continuation = `Continue this mission: "${instruction}". The approved action "${params.toolName || 'tool'}" executed: ${toolSummary}. Complete any remaining steps without re-running the approved action.`;

  if (workflow?.id) {
    await updateWorkflowStatus(params.tenantId, workflow.id as string, {
      status: 'running',
      blocking_approval_id: null,
    });
  }

  const agentResult = await runBonnieAgent({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: continuation,
    history: [],
    workflowId: workflow?.id as string | undefined,
    conversationId: (workflow?.conversation_id as string | undefined) || undefined,
    moduleContext: (workflow?.module as BonnieModuleId | undefined) || undefined,
  });

  if (workflow?.id) {
    await updateWorkflowStatus(params.tenantId, workflow.id as string, {
      status: agentResult.executionStatus === 'queued_for_approval' ? 'waiting_for_approval' : 'completed',
      final_response: agentResult.response,
      execution_status: agentResult.executionStatus,
      tool_results: agentResult.toolResults,
      rounds: agentResult.rounds,
      completed_at: agentResult.executionStatus === 'queued_for_approval' ? null : new Date().toISOString(),
    });
  }

  return {
    continued: true,
    response: agentResult.response,
    toolResults: agentResult.toolResults,
    executionStatus: agentResult.executionStatus,
  };
}

export async function approveAndResumeBonnieMission(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
  instruction?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: approvalRow } = await admin
    .from('autonomous_runner_approvals')
    .select('workflow_id, status')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.approvalId)
    .maybeSingle();

  if (approvalRow?.status && approvalRow.status !== 'pending') {
    return {
      execution: { success: false, error: `Approval already ${approvalRow.status}. Refresh and review the latest state.` },
      continuation: { continued: false as const },
    };
  }

  const execution = await resumeApprovedTool({
    tenantId: params.tenantId,
    userId: params.userId,
    approvalId: params.approvalId,
  });

  if (!execution.success) {
    return { execution, continuation: { continued: false as const } };
  }

  const continuation = await resumeBonnieMissionAfterApproval({
    tenantId: params.tenantId,
    userId: params.userId,
    approvalId: params.approvalId,
    instruction: params.instruction,
    toolName: execution.result?.tool,
    toolResult: execution.result,
    workflowId: approvalRow?.workflow_id as string | null | undefined,
  });

  return { execution, continuation };
}
