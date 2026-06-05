import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';

export async function listAllMcpTools() {
  const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
  initializeRegistry();
  const registryTools = listTools();
  const registryNames = new Set(registryTools.map((t) => t.name));

  const sanitizedRegistry = registryTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: sanitizeToolSchemaForClient(t.inputSchema as Record<string, unknown>),
  }));

  const sanitizedLegacy = MCP_TOOLS.filter((t) => !registryNames.has(t.name)).map((t) => ({
    ...t,
    inputSchema: sanitizeToolSchemaForClient(t.inputSchema as Record<string, unknown>),
  }));

  return [...sanitizedRegistry, ...sanitizedLegacy];
}
