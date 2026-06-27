import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import { SUPPLEMENTAL_MCP_TOOLS, type McpDiscoveryTool } from '@/lib/mcp/supplementalToolDefinitions';

export type UnifiedMcpTool = McpDiscoveryTool;

let cachedTools: UnifiedMcpTool[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

function dedupeTools(tools: UnifiedMcpTool[]): UnifiedMcpTool[] {
  const seen = new Set<string>();
  const merged: UnifiedMcpTool[] = [];
  for (const tool of tools) {
    if (!tool?.name || seen.has(tool.name)) continue;
    seen.add(tool.name);
    merged.push(tool);
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Single source of truth for MCP tool discovery across Bonnie, /api/mcp, and MCPServer.
 * Priority: registry handlers → legacy manifest → supplemental definitions.
 */
export async function getUnifiedMcpTools(options?: {
  sanitizeForClient?: boolean;
  forceRefresh?: boolean;
}): Promise<UnifiedMcpTool[]> {
  const sanitizeForClient = options?.sanitizeForClient ?? true;
  const now = Date.now();

  if (!options?.forceRefresh && cachedTools && now - cacheTime < CACHE_TTL_MS) {
    return cachedTools;
  }

  const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
  initializeRegistry();

  const registryTools = listTools(false).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as Record<string, unknown>,
  }));

  const registryNames = new Set(registryTools.map((t) => t.name));
  const manifestLegacy = (MCP_TOOLS as UnifiedMcpTool[]).filter((t) => !registryNames.has(t.name));
  const supplemental = SUPPLEMENTAL_MCP_TOOLS.filter(
    (t) => !registryNames.has(t.name) && !manifestLegacy.some((m) => m.name === t.name)
  );

  const merged = dedupeTools([...registryTools, ...manifestLegacy, ...supplemental]);

  cachedTools = sanitizeForClient
    ? merged.map((tool) => ({
        ...tool,
        inputSchema: sanitizeToolSchemaForClient(tool.inputSchema),
      }))
    : merged;
  cacheTime = now;

  return cachedTools;
}

export async function getUnifiedMcpToolCount(): Promise<number> {
  const tools = await getUnifiedMcpTools();
  return tools.length;
}

export function invalidateUnifiedMcpToolCache(): void {
  cachedTools = null;
  cacheTime = 0;
}

/** @deprecated Use getUnifiedMcpTools — kept for backward compatibility */
export async function listAllMcpTools() {
  return getUnifiedMcpTools();
}
