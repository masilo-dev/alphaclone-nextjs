import { initializeRegistry, executeTool, hasTool } from '@/lib/mcp/tool-registry';
import { BONNIE_CUSTOM_TOOLS, BONNIE_MCP_SERVER_TOOLS } from '@/lib/bonnie/bonnieToolCatalog';
import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';

export type BonnieToolCall = {
  tool: string;
  arguments?: Record<string, unknown>;
};

export type BonnieToolResult = {
  tool: string;
  success: boolean;
  summary: string;
  details?: string;
};

const CUSTOM_SET = new Set<string>(BONNIE_CUSTOM_TOOLS);
const MCP_TOOL_SET = new Set<string>(BONNIE_MCP_SERVER_TOOLS);

function extractToolText(result: { content?: Array<{ text?: string }> }): string {
  const chunk = result.content?.[0]?.text;
  if (!chunk) return 'No output';
  try {
    const parsed = JSON.parse(chunk);
    return JSON.stringify(parsed, null, 2).slice(0, 2000);
  } catch {
    return chunk.slice(0, 2000);
  }
}

export async function executeBonnieToolCalls(
  tenantId: string,
  userId: string,
  toolCalls: BonnieToolCall[]
): Promise<BonnieToolResult[]> {
  initializeRegistry();
  const results: BonnieToolResult[] = [];

  for (const call of toolCalls.slice(0, 8)) {
    const tool = String(call.tool || '').trim();
    const args = { ...(call.arguments || {}) };

    try {
      if (CUSTOM_SET.has(tool)) {
        results.push(await executeCustomTool(tool, tenantId, userId, args));
        continue;
      }

      const mergedArgs = {
        ...args,
        tenant_id: args.tenant_id || tenantId,
        user_id: args.user_id || userId,
      };

      if (hasTool(tool)) {
        const result = await executeTool(tenantId, userId, tool, mergedArgs);
        const text = extractToolText(result);
        results.push({
          tool,
          success: !result.isError,
          summary: result.isError ? `Failed: ${text.slice(0, 200)}` : `${tool} completed`,
          details: text,
        });
        continue;
      }

      if (MCP_TOOL_SET.has(tool)) {
        const { executeBonnieMcpTool } = await import('@/lib/bonnie/bonnieMcpBridge');
        const result = await executeBonnieMcpTool(tool, mergedArgs, tenantId, userId);
        const text = extractToolText(result);
        results.push({
          tool,
          success: !result.isError,
          summary: result.isError ? `Failed: ${text.slice(0, 200)}` : `${tool} completed`,
          details: text,
        });
        continue;
      }

      results.push({
        tool,
        success: false,
        summary: `Tool "${tool}" is not available to Bonnie. Try get_whatsapp_status, queue_email_campaign_send, or get_business_snapshot.`,
      });
    } catch (err: any) {
      results.push({
        tool,
        success: false,
        summary: err?.message || 'Tool execution failed',
      });
    }
  }

  return results;
}

async function executeCustomTool(
  tool: string,
  tenantId: string,
  _userId: string,
  args: Record<string, unknown> = {}
): Promise<BonnieToolResult> {
  if (tool === 'run_autonomous_scan') {
    const { autonomousRunnerService } = await import('@/services/autonomousRunnerService');
    const result = await autonomousRunnerService.runForTenant(tenantId);
    const actionCount = result.run?.actions?.length ?? 0;
    return {
      tool,
      success: result.success,
      summary: result.success
        ? `Autonomous scan finished (${actionCount} actions).`
        : `Autonomous scan failed: ${result.error || 'unknown error'}`,
      details: JSON.stringify(result.run?.actions || [], null, 2).slice(0, 1500),
    };
  }

  if (tool === 'summarize_workspace') {
    const snapshot = await getBonnieWorkspaceSnapshot(tenantId);
    return {
      tool,
      success: true,
      summary: 'Workspace snapshot loaded.',
      details: JSON.stringify(snapshot, null, 2),
    };
  }

  if (tool === 'search_facebook_leads') {
    const query = String(args.query || args.q || args.name || '').trim();
    if (!query) {
      return { tool, success: false, summary: 'Provide a search query (name, email, company, or phone).' };
    }
    const { searchFacebookLeads } = await import('@/services/facebookLeadSearchService');
    const data = await searchFacebookLeads(tenantId, query);
    return {
      tool,
      success: true,
      summary: `Found ${data.total} Facebook lead match(es) for "${query}".`,
      details: JSON.stringify(data, null, 2).slice(0, 2000),
    };
  }

  return { tool, success: false, summary: `Unknown custom tool: ${tool}` };
}
