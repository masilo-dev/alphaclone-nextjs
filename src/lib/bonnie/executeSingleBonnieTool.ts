import { forceSessionArgs } from '@/lib/mcp/sanitizeToolSchema';
import { initializeRegistry, executeTool, hasTool } from '@/lib/mcp/tool-registry';
import { BONNIE_CUSTOM_TOOLS } from '@/lib/bonnie/bonnieToolCatalog';
import { evaluateToolPolicy } from '@/lib/ai/ToolPolicyGate';
import { resolveBonnieToolSets } from '@/lib/bonnie/resolveBonnieTools';
import { recordDecision } from '@/services/nexusDecisionLogService';
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

function buildApprovalPreview(
  tool: string,
  args: Record<string, unknown>
): BonnieToolResult['preview'] {
  const target =
    args.to ||
    args.recipient ||
    args.email ||
    args.phone ||
    args.client_id ||
    args.contact_id ||
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

export async function executeSingleBonnieTool(params: {
  tenantId: string;
  userId: string;
  tool: string;
  args?: Record<string, unknown>;
  skipPolicy?: boolean;
  policySource?: 'bonnie' | 'mcp' | 'playbook';
  instruction?: string;
  workflowId?: string;
  conversationId?: string;
}): Promise<BonnieToolResult> {
  const { tenantId, userId, skipPolicy = false, policySource = 'bonnie', instruction, workflowId, conversationId } = params;
  const tool = String(params.tool || '').trim();
  const args = forceSessionArgs({ ...(params.args || {}) }, { tenantId, userId });

  initializeRegistry();

  let riskClass: string | undefined;

  // ToolPolicyGate — EU AI Act Art. 14 human oversight
  if (!skipPolicy) {
    const policy = await evaluateToolPolicy({
      tenantId,
      userId,
      toolName: tool,
      source: policySource,
      args,
      instruction,
      workflowId,
      conversationId,
    });
    riskClass = policy.riskClass;

    if (policy.outcome === 'deny') {
      await recordDecision({
        tenantId,
        userId,
        instruction,
        toolName: tool,
        toolArgs: args,
        outcome: 'denied',
        riskClass,
        reasoning: policy.reason,
      });
      return {
        tool,
        success: false,
        summary: policy.reason,
        riskClass,
      };
    }

    if (policy.outcome === 'queue_approval' && policy.approvalId) {
      const preview = buildApprovalPreview(tool, args);
      await recordDecision({
        tenantId,
        userId,
        instruction,
        toolName: tool,
        toolArgs: args,
        outcome: 'queued_approval',
        riskClass,
        reasoning: policy.reason,
        approvalId: policy.approvalId,
      });
      return {
        tool,
        success: true,
        summary: policy.reason,
        approvalRequired: true,
        approvalId: policy.approvalId,
        riskClass,
        preview,
      };
    }
  }

  try {
    let toolResult: BonnieToolResult;

    if (CUSTOM_SET.has(tool)) {
      const { executeCustomTool } = await import('@/lib/bonnie/bonnieCustomTools');
      toolResult = await executeCustomTool(tool, tenantId, userId, args);
    } else {
      if (hasTool(tool)) {
        const result = await executeTool(tenantId, userId, tool, args);
        const text = extractToolText(result);
        toolResult = {
          tool,
          success: !result.isError,
          summary: result.isError ? `Failed: ${text.slice(0, 200)}` : `${tool} completed`,
          details: text,
        };
      } else {
        const { mcpServerTools } = await resolveBonnieToolSets();
        if (mcpServerTools.includes(tool)) {
          const { executeBonnieMcpTool } = await import('@/lib/bonnie/bonnieMcpBridge');
          const result = await executeBonnieMcpTool(tool, args, tenantId, userId);
          const text = extractToolText(result);
          toolResult = {
            tool,
            success: !result.isError,
            summary: result.isError ? `Failed: ${text.slice(0, 200)}` : `${tool} completed`,
            details: text,
          };
        } else {
          toolResult = {
            tool,
            success: false,
            summary: `Tool "${tool}" is not available to Bonnie.`,
          };
        }
      }
    }

    if (!skipPolicy) {
      await recordDecision({
        tenantId,
        userId,
        instruction,
        toolName: tool,
        toolArgs: args,
        outcome: toolResult.success ? 'executed' : 'failed',
        riskClass,
        reasoning: toolResult.summary,
      });
    }

    return toolResult;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Tool execution failed';
    if (!skipPolicy) {
      await recordDecision({
        tenantId,
        userId,
        instruction,
        toolName: tool,
        toolArgs: args,
        outcome: 'failed',
        riskClass,
        reasoning: message,
      });
    }
    return { tool, success: false, summary: message };
  }
}
