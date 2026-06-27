import { runBonnieAgent } from '@/lib/bonnie/bonnieAgent';
import { resumeApprovedTool } from '@/lib/bonnie/resumeApprovedTool';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';

export async function resumeBonnieMissionAfterApproval(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
  instruction?: string;
  toolName?: string;
  toolResult?: BonnieToolResult;
}): Promise<{ continued: boolean; response?: string; toolResults?: BonnieToolResult[] }> {
  const instruction = params.instruction?.trim();
  if (!instruction) {
    return { continued: false };
  }

  const toolSummary = params.toolResult?.summary || 'completed';
  const continuation = `Continue this mission: "${instruction}". The approved action "${params.toolName || 'tool'}" executed: ${toolSummary}. Complete any remaining steps without re-running the approved action.`;

  const agentResult = await runBonnieAgent({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: continuation,
    history: [],
  });

  return {
    continued: true,
    response: agentResult.response,
    toolResults: agentResult.toolResults,
  };
}

export async function approveAndResumeBonnieMission(params: {
  tenantId: string;
  userId: string;
  approvalId: string;
  instruction?: string;
}) {
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
  });

  return { execution, continuation };
}
