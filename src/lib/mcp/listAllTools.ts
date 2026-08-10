import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import {
  compactMcpToolForDiscovery,
  estimateToolsListBytes,
} from '@/lib/mcp/compactToolSchema';
import { SUPPLEMENTAL_MCP_TOOLS, type McpDiscoveryTool } from '@/lib/mcp/supplementalToolDefinitions';
import { resolveToolAnnotations } from '@/lib/mcp/toolAnnotations';
import {
  coreTools,
  DISCOVERY_CONTROL_TOOLS,
  moduleForTool,
} from '@/lib/mcp/progressiveDiscovery';

export type UnifiedMcpTool = McpDiscoveryTool;

let cachedFullTools: UnifiedMcpTool[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

/** Optional discovery aliases (search/fetch) available to all clients. */
const DISCOVERY_ALIAS_TOOLS: UnifiedMcpTool[] = [
  {
    name: 'search',
    description:
      'Search the AlphaClone workspace (documents, CRM leads/contacts, and related business records). Use for discovery questions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch',
    description:
      'Fetch a workspace record by id or URI previously returned by search (documents, leads, invoices, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Record id or mcp resource URI from search results' },
      },
      required: ['id'],
    },
  },
];

const DISCOVERY_ROUTED_TOOL_NAMES = new Set([
  ...DISCOVERY_ALIAS_TOOLS.map((tool) => tool.name),
  ...DISCOVERY_CONTROL_TOOLS.map((tool) => tool.name),
]);

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

function withAnnotations(tools: UnifiedMcpTool[]): UnifiedMcpTool[] {
  return tools.map((tool) => ({
    ...tool,
    annotations: tool.annotations || resolveToolAnnotations(tool.name),
  }));
}

function prepareDiscoveryTools(
  tools: UnifiedMcpTool[],
  sanitizeForClient: boolean
): UnifiedMcpTool[] {
  if (!sanitizeForClient) return tools;
  // Compact schemas so Claude/ChatGPT can ingest the FULL platform list.
  return tools.map((tool) =>
    compactMcpToolForDiscovery({
      ...tool,
      inputSchema: sanitizeToolSchemaForClient(tool.inputSchema),
    })
  );
}

/**
 * Single source of truth for MCP tool discovery.
 * The default is the full executable catalog so every MCP client can discover
 * and execute the same AlphaClone capability contract. Progressive discovery
 * remains available only as an explicit opt-in for clients that ask for it.
 */
export async function getUnifiedMcpTools(options?: {
  sanitizeForClient?: boolean;
  forceRefresh?: boolean;
  /** @deprecated Prefer clientId + registered catalog mode */
  forChatGPT?: boolean;
  clientId?: string | null;
  clientLabel?: string | null;
  userAgent?: string | null;
  loadedModules?: string[];
  catalogMode?: 'progressive' | 'full';
}): Promise<UnifiedMcpTool[]> {
  const sanitizeForClient = options?.sanitizeForClient ?? true;
  const catalogMode = options?.catalogMode || 'full';
  const now = Date.now();

  if (
    !options?.forceRefresh &&
    now - cacheTime < CACHE_TTL_MS &&
    cachedFullTools &&
    cachedFullTools.length > 0
  ) {
    initializeRegistry();
    const executableNames = new Set([
      ...listTools(false).map((tool) => tool.name),
      ...DISCOVERY_ROUTED_TOOL_NAMES,
    ]);
    const cached = selectCatalogTools(cachedFullTools, {
      catalogMode,
      loadedModules: options?.loadedModules,
      executableNames,
    });
    console.info(
      `[mcp.tools/list] cache hit catalog=${catalogMode} count=${cached.length} bytes≈${estimateToolsListBytes(cached)}`
    );
    return cached;
  }

  let registryTools: UnifiedMcpTool[] = [];
  let registryError: string | null = null;
  try {
    initializeRegistry();
    registryTools = listTools(false).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  } catch (err: any) {
    registryError = err?.message || String(err);
    console.error('[mcp.tools/list] registry initialization failed:', registryError);
  }

  let manifestLegacy: UnifiedMcpTool[] = [];
  try {
    const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
    const registryNames = new Set(registryTools.map((t) => t.name));
    manifestLegacy = (MCP_TOOLS as UnifiedMcpTool[]).filter((t) => !registryNames.has(t.name));
  } catch (err: any) {
    console.error('[mcp.tools/list] toolManifest load failed:', err?.message || err);
  }

  const registryNames = new Set(registryTools.map((t) => t.name));
  const executableNames = new Set([...registryNames, ...DISCOVERY_ROUTED_TOOL_NAMES]);
  const supplemental = SUPPLEMENTAL_MCP_TOOLS.filter(
    (t) => !registryNames.has(t.name) && !manifestLegacy.some((m) => m.name === t.name)
  );
  const aliases = DISCOVERY_ALIAS_TOOLS.filter(
    (t) =>
      !registryNames.has(t.name) &&
      !manifestLegacy.some((m) => m.name === t.name) &&
      !supplemental.some((m) => m.name === t.name)
  );

  // Discovery controls are real callable tools too. Keep them in both the full
  // and progressive catalogues so module/search guidance never disappears when
  // a client is upgraded from the bounded surface.
  const merged = dedupeTools([
    ...registryTools,
    ...manifestLegacy,
    ...supplemental,
    ...aliases,
    ...DISCOVERY_CONTROL_TOOLS,
  ]);
  const annotated = withAnnotations(merged);

  if (merged.length === 0) {
    console.error(
      `[mcp.tools/list] CRITICAL: zero tools discovered. registryError=${registryError || 'none'} registry=${registryTools.length} manifest=${manifestLegacy.length}`
    );
  } else {
    console.info(
      `[mcp.tools/list] discovered total=${merged.length} registry=${registryTools.length} manifest_extra=${manifestLegacy.length} supplemental=${supplemental.length} catalog=${catalogMode}`
    );
  }

  cachedFullTools = prepareDiscoveryTools(annotated, sanitizeForClient);

  cacheTime = now;
  const result = selectCatalogTools(cachedFullTools, {
    catalogMode,
    loadedModules: options?.loadedModules,
    executableNames,
  });
  console.info(
    `[mcp.tools/list] returning catalog=${catalogMode} count=${result.length} bytes≈${estimateToolsListBytes(result)}`
  );
  return result;
}

export async function getUnifiedMcpToolCount(options?: {
  forChatGPT?: boolean;
  clientId?: string | null;
}): Promise<number> {
  const tools = await getUnifiedMcpTools(options);
  return tools.length;
}

export function invalidateUnifiedMcpToolCache(): void {
  cachedFullTools = null;
  cacheTime = 0;
}

function selectCatalogTools(
  full: UnifiedMcpTool[],
  options: {
    catalogMode: 'progressive' | 'full';
    loadedModules?: string[];
    executableNames: Set<string>;
  },
): UnifiedMcpTool[] {
  if (options.catalogMode === 'full') return full;

  const loaded = new Set((options.loadedModules || []).map((m) => m.toLowerCase()));
  const coreNames = new Set(coreTools(full, 40).map((tool) => tool.name));
  for (const tool of DISCOVERY_CONTROL_TOOLS) coreNames.add(tool.name);
  for (const tool of DISCOVERY_ALIAS_TOOLS) coreNames.add(tool.name);

  return full
    .filter((tool) => options.executableNames.has(tool.name))
    .filter((tool) => coreNames.has(tool.name) || loaded.has(moduleForTool(tool.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** @deprecated Use getUnifiedMcpTools — kept for backward compatibility */
export async function listAllMcpTools() {
  return getUnifiedMcpTools();
}
