import type { BonnieToolCall, BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { BONNIE_MAX_TOOLS_PER_ROUND } from '@/lib/bonnie/bonnieAgentConfig';

export type { BonnieToolCall, BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';

export async function executeBonnieToolCalls(
  tenantId: string,
  userId: string,
  toolCalls: BonnieToolCall[],
  instruction?: string,
  context?: { workflowId?: string; conversationId?: string }
): Promise<BonnieToolResult[]> {
  const calls = toolCalls.slice(0, BONNIE_MAX_TOOLS_PER_ROUND);

  return Promise.all(
    calls.map(async (call) => {
      const tool = String(call.tool || '').trim();
      const args = { ...(call.arguments || {}) };
      return executeSingleBonnieTool({
        tenantId,
        userId,
        tool,
        args,
        instruction,
        workflowId: context?.workflowId,
        conversationId: context?.conversationId,
      });
    })
  );
}
