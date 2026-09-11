import { forceSessionArgs } from '@/lib/mcp/sanitizeToolSchema';
import { BONNIE_MCP_SERVER_TOOLS } from './bonnieToolCatalog';

const MCP_TOOL_SET = new Set<string>(BONNIE_MCP_SERVER_TOOLS);

export function isBonnieMcpServerTool(toolName: string): boolean {
  return MCP_TOOL_SET.has(toolName);
}

export async function executeBonnieMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string,
  userId: string
): Promise<{ content?: Array<{ text?: string }>; isError?: boolean }> {
  const merged = forceSessionArgs(args, { tenantId, userId });

  const { initializeRegistry, hasTool, executeTool } = await import('@/lib/mcp/tool-registry');
  initializeRegistry();
  if (hasTool(toolName)) {
    return executeTool(tenantId, userId, toolName, merged);
  }

  const { createMCPServer } = await import('@/services/mcp/MCPServer');
  const server = createMCPServer({ tenantId, userId });
  return server.runTool(toolName, merged);
}
