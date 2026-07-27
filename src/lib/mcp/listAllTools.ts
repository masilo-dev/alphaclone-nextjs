import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import {
  compactMcpToolForDiscovery,
  estimateToolsListBytes,
} from '@/lib/mcp/compactToolSchema';
import { SUPPLEMENTAL_MCP_TOOLS, type McpDiscoveryTool } from '@/lib/mcp/supplementalToolDefinitions';
import {
  CHATGPT_CONNECTOR_TOOL_NAMES,
  resolveToolAnnotations,
} from '@/lib/mcp/toolAnnotations';
import { coreTools, DISCOVERY_CONTROL_TOOLS } from '@/lib/mcp/progressiveDiscovery';
import { getToolCatalogModeForClient } from '@/lib/mcp/ensureOAuthClient';

export type UnifiedMcpTool = McpDiscoveryTool;

let cachedFullTools: UnifiedMcpTool[] | null = null;
let cachedCuratedTools: UnifiedMcpTool[] | null = null;
let cachedConnectorTools: UnifiedMcpTool[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;
const CONNECTOR_TOOL_SET = new Set<string>(CHATGPT_CONNECTOR_TOOL_NAMES);

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
 * Catalog selection follows the registered OAuth-client policy. The default is
 * the compacted full platform catalog so clients can actually call every
 * authorised tool. Progressive discovery remains available as a selection aid,
 * rather than being used to hide callable tools from the client.
 */
export async function getUnifiedMcpTools(options?: {
  sanitizeForClient?: boolean;
  forceRefresh?: boolean;
  /** @deprecated Prefer clientId + registered catalog mode */
  forChatGPT?: boolean;
  clientId?: string | null;
  clientLabel?: string | null;
  userAgent?: string | null;
}): Promise<UnifiedMcpTool[]> {
  const sanitizeForClient = options?.sanitizeForClient ?? true;
  // Keep the legacy explicit overrides for server callers. Normal tools/list
  // requests follow the registered client policy (full by default).
  const catalogMode =
    options?.forChatGPT === true
      ? 'connector'
      : options?.forChatGPT === false
        ? 'full'
        : getToolCatalogModeForClient(options?.clientId) === 'curated'
          ? 'connector'
          : 'full';
  const now = Date.now();

  if (
    !options?.forceRefresh &&
    now - cacheTime < CACHE_TTL_MS &&
    cachedFullTools &&
    cachedFullTools.length > 0 &&
    (catalogMode !== 'connector' || (cachedConnectorTools && cachedConnectorTools.length > 0))
  ) {
    const cached =
      catalogMode === 'connector' ? cachedConnectorTools! : cachedFullTools;
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
  cachedConnectorTools = cachedFullTools.filter((tool) => CONNECTOR_TOOL_SET.has(tool.name));

  cachedCuratedTools = coreTools(cachedFullTools, 32);
  for (const control of withAnnotations(DISCOVERY_CONTROL_TOOLS)) {
    if (!cachedCuratedTools.some((tool) => tool.name === control.name)) {
      cachedCuratedTools.push(...prepareDiscoveryTools([control], sanitizeForClient));
    }
  }
  for (const alias of withAnnotations(DISCOVERY_ALIAS_TOOLS)) {
    if (!cachedCuratedTools.some((t) => t.name === alias.name)) {
      cachedCuratedTools.push(
        ...prepareDiscoveryTools([alias], sanitizeForClient)
      );
    }
  }
  cachedCuratedTools.sort((a, b) => a.name.localeCompare(b.name));

  cacheTime = now;
  const result = catalogMode === 'connector' ? cachedConnectorTools : cachedFullTools;
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
  cachedCuratedTools = null;
  cachedConnectorTools = null;
  cacheTime = 0;
}

/** @deprecated Use getUnifiedMcpTools — kept for backward compatibility */
export async function listAllMcpTools() {
  return getUnifiedMcpTools();
}
