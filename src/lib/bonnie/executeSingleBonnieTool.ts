import { initializeRegistry, executeTool, hasTool } from '@/lib/mcp/tool-registry';
import { BONNIE_CUSTOM_TOOLS } from '@/lib/bonnie/bonnieToolCatalog';
import { evaluateToolPolicy } from '@/lib/ai/ToolPolicyGate';
import { resolveBonnieToolSets } from '@/lib/bonnie/resolveBonnieTools';
import type { BonnieToolResult } from '@/lib/bonnie/bonnieToolTypes';

const CUSTOM_SET = new Set<string>(BONNIE_CUSTOM_TOOLS);

function extractToolText(result: { content?: Array<{ text?: string }> }): string {
  const chunk = result.content?.[0]?.text;
  if (!chunk) return 'No output';
  try {
    const parsed = JSON.parse(chunk);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return 'No results found';
      return `${parsed.length} results found`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.message) return String(parsed.message);
      const identifier = parsed.name || parsed.title || parsed.text || parsed.id;
      if (identifier) return String(identifier);
    }
    return String(parsed);
  } catch {
    return chunk.slice(0, 2000);
  }
}

export async function executeSingleBonnieTool(params: {
  tenantId: string;
  userId: string;
  tool: string;
  args?: Record<string, unknown>;
  skipPolicy?: boolean;
  policySource?: 'bonnie' | 'mcp' | 'playbook';
}): Promise<BonnieToolResult> {
  const { tenantId, userId, skipPolicy = false, policySource = 'bonnie' } = params;
  const tool = String(params.tool || '').trim();
  const args = { ...(params.args || {}) };

  initializeRegistry();

  if (!skipPolicy) {
    const policy = await evaluateToolPolicy({
      tenantId,
      userId,
      toolName: tool,
      source: policySource,
      args,
    });

    if (policy.outcome === 'deny') {
      return { tool, success: false, summary: policy.reason };
    }

    if (policy.outcome === 'queue_approval') {
      return {
        tool,
        success: false,
        summary: `Approval required: ${policy.reason}`,
        details: policy.approvalId ? `Approval ID: ${policy.approvalId}` : undefined,
      };
    }
  }

  try {
    if (CUSTOM_SET.has(tool)) {
      const { executeCustomTool } = await import('@/lib/bonnie/bonnieCustomTools');
      return executeCustomTool(tool, tenantId, userId, args);
    }

    const mergedArgs = {
      ...args,
      tenant_id: args.tenant_id || tenantId,
      user_id: args.user_id || userId,
    };

    if (hasTool(tool)) {
      const result = await executeTool(tenantId, userId, tool, mergedArgs);
      const text = extractToolText(result);
      return {
        tool,
        success: !result.isError,
        summary: result.isError ? `Failed: ${text.slice(0, 200)}` : `${tool} completed`,
        details: text,
      };
    }

    const { mcpServerTools } = await resolveBonnieToolSets();
    if (mcpServerTools.includes(tool)) {
      const { executeBonnieMcpTool } = await import('@/lib/bonnie/bonnieMcpBridge');
      const result = await executeBonnieMcpTool(tool, mergedArgs, tenantId, userId);
      const text = extractToolText(result);
      return {
        tool,
        success: !result.isError,
        summary: result.isError ? `Failed: ${text.slice(0, 200)}` : `${tool} completed`,
        details: text,
      };
    }

    return {
      tool,
      success: false,
      summary: `Tool "${tool}" is not available to Bonnie.`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tool execution failed';
    return { tool, success: false, summary: message };
  }
}
