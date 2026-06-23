import { createMCPServer } from '@/services/mcp/MCPServer';
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
  const server = createMCPServer({ tenantId, userId });
  const merged = {
    ...args,
    tenant_id: args.tenant_id || tenantId,
    user_id: args.user_id || userId,
  };
  return server.runTool(toolName, merged);
}
