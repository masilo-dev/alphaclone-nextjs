import { listAllMcpTools } from '@/lib/mcp/listAllTools';
import { BONNIE_CUSTOM_TOOLS } from '@/lib/bonnie/bonnieToolCatalog';

let cachedRegistryTools: string[] | null = null;
let cachedMcpTools: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

export async function resolveBonnieToolSets(): Promise<{
  registryTools: string[];
  mcpServerTools: string[];
  customTools: readonly string[];
  allTools: string[];
}> {
  const now = Date.now();
  if (cachedRegistryTools && cachedMcpTools && now - cacheTime < CACHE_TTL_MS) {
    return {
      registryTools: cachedRegistryTools,
      mcpServerTools: cachedMcpTools,
      customTools: BONNIE_CUSTOM_TOOLS,
      allTools: [...cachedRegistryTools, ...cachedMcpTools, ...BONNIE_CUSTOM_TOOLS],
    };
  }

  const all = await listAllMcpTools();
  const names = all.map((t) => t.name);
  const { initializeRegistry, listTools } = await import('@/lib/mcp/tool-registry');
  initializeRegistry();
  const registryNames = new Set(listTools().map((t) => t.name));
  const customSet = new Set<string>(BONNIE_CUSTOM_TOOLS);

  cachedRegistryTools = names.filter((n) => registryNames.has(n) && !customSet.has(n));
  cachedMcpTools = names.filter((n) => !registryNames.has(n) && !customSet.has(n));
  cacheTime = now;

  return {
    registryTools: cachedRegistryTools,
    mcpServerTools: cachedMcpTools,
    customTools: BONNIE_CUSTOM_TOOLS,
    allTools: [...cachedRegistryTools, ...cachedMcpTools, ...BONNIE_CUSTOM_TOOLS],
  };
}

export function invalidateBonnieToolCache(): void {
  cachedRegistryTools = null;
  cachedMcpTools = null;
  cacheTime = 0;
}
