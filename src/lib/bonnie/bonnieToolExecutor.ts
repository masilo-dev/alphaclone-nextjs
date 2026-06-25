import type { BonnieToolCall, BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';

export type { BonnieToolCall, BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';

export async function executeBonnieToolCalls(
  tenantId: string,
  userId: string,
  toolCalls: BonnieToolCall[]
): Promise<BonnieToolResult[]> {
  const results: BonnieToolResult[] = [];

  for (const call of toolCalls.slice(0, 8)) {
    const tool = String(call.tool || '').trim();
    const args = { ...(call.arguments || {}) };
    results.push(
      await executeSingleBonnieTool({
        tenantId,
        userId,
        tool,
        args,
      })
    );
  }

  return results;
}
