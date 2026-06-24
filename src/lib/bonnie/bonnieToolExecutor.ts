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

/**
 * Extract plain text from tool result content.
 * Returns human-readable text, not re-stringified JSON.
 */
function extractToolText(result: { content?: Array<{ text?: string }> }): string {
  const chunk = result.content?.[0]?.text;
  if (!chunk) return 'No output';
  
  try {
    // Try to parse as JSON - if successful, return formatted summary
    const parsed = JSON.parse(chunk);
    
    // If it's an array, return count and brief summary
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return 'No results found';
      if (parsed.length === 1) {
        const first = parsed[0];
        if (typeof first === 'object' && first !== null) {
          // Extract key identifying fields
          const name = first.name || first.title || first.full_name || first.email || first.id;
          return `Found: ${name}`;
        }
        return String(first);
      }
      return `${parsed.length} results found`;
    }
    
    // If it's an object, extract key information
    if (typeof parsed === 'object' && parsed !== null) {
      // Success/error messages
      if (parsed.message) return String(parsed.message);
      if (parsed.success && parsed.message) return String(parsed.message);
      
      // Name/title identification
      const identifier = parsed.name || parsed.title || parsed.full_name || parsed.email || 
                        parsed.subject || parsed.campaign_name || parsed.id;
      if (identifier) return `${identifier}`;
      
      // Count results
      if (parsed.count !== undefined) return `${parsed.count} items`;
      if (parsed.total !== undefined) return `${parsed.total} total`;
      
      // Status information
      if (parsed.status) return `Status: ${parsed.status}`;
      
      // Fallback: return keys summary
      const keys = Object.keys(parsed).slice(0, 3).join(', ');
      return `Data: ${keys}...`;
    }
    
    // Primitive values
    return String(parsed);
  } catch {
    // Not valid JSON, return as-is (truncated)
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
      details: `${actionCount} actions executed.`,
    };
  }

  if (tool === 'summarize_workspace') {
    const snapshot = await getBonnieWorkspaceSnapshot(tenantId);
    // Create human-readable summary from the counts
    const summary: string[] = [];
    if (snapshot.counts.deals) summary.push(`${snapshot.counts.deals} deals`);
    if (snapshot.counts.open_tickets) summary.push(`${snapshot.counts.open_tickets} tickets`);
    if (snapshot.counts.unpaid_invoices) summary.push(`${snapshot.counts.unpaid_invoices} unpaid invoices`);
    if (snapshot.counts.open_tasks) summary.push(`${snapshot.counts.open_tasks} tasks`);
    if (snapshot.counts.leads) summary.push(`${snapshot.counts.leads} leads`);

    return {
      tool,
      success: true,
      summary: summary.length > 0 ? `Workspace: ${summary.join(', ')}` : 'Workspace snapshot loaded.',
      details: summary.join(', ') || 'Workspace data retrieved successfully.',
    };
  }

  if (tool === 'search_facebook_leads') {
    const query = String(args.query || args.q || args.name || '').trim();
    if (!query) {
      return { tool, success: false, summary: 'Provide a search query (name, email, company, or phone).' };
    }
    const { searchFacebookLeads } = await import('@/services/facebookLeadSearchService');
    const data = await searchFacebookLeads(tenantId, query);
    // Build human-readable details - combine local and graph leads
    const allLeads = [...(data.local || []), ...(data.graph || [])];
    const leadDetails = allLeads.slice(0, 5).map((lead: any) =>
      `- ${lead.name || lead.full_name || 'Unknown'} (${lead.email || 'no email'})`
    ).join('\n') || 'No leads found';

    return {
      tool,
      success: true,
      summary: `Found ${data.total} Facebook lead match(es) for "${query}".`,
      details: leadDetails,
    };
  }

  return { tool, success: false, summary: `Unknown custom tool: ${tool}` };
}
