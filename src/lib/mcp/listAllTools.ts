import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import { SUPPLEMENTAL_MCP_TOOLS, type McpDiscoveryTool } from '@/lib/mcp/supplementalToolDefinitions';
import {
  CHATGPT_CONNECTOR_TOOL_NAMES,
  resolveToolAnnotations,
} from '@/lib/mcp/toolAnnotations';
import { getToolCatalogModeForClient } from '@/lib/mcp/ensureOAuthClient';

export type UnifiedMcpTool = McpDiscoveryTool;

let cachedFullTools: UnifiedMcpTool[] | null = null;
let cachedCuratedTools: UnifiedMcpTool[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

const CURATED_TOOL_SET = new Set<string>(CHATGPT_CONNECTOR_TOOL_NAMES);

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

/**
 * Single source of truth for MCP tool discovery.
 * Default = FULL catalog for every standards-compliant client.
 * Curated catalog only when the registered client seed opts in (size-limited Apps connectors).
 * Never sniff User-Agent to decide capabilities.
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
  const curated =
    options?.forChatGPT === true ||
    getToolCatalogModeForClient(options?.clientId) === 'curated';
  const now = Date.now();

  if (
    !options?.forceRefresh &&
    now - cacheTime < CACHE_TTL_MS &&
    cachedFullTools &&
    cachedFullTools.length > 0 &&
    (!curated || (cachedCuratedTools && cachedCuratedTools.length > 0))
  ) {
    const cached = curated ? cachedCuratedTools! : cachedFullTools;
    console.info(
      `[mcp.tools/list] cache hit catalog=${curated ? 'curated' : 'full'} count=${cached.length}`
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

  const merged = dedupeTools([...registryTools, ...manifestLegacy, ...supplemental, ...aliases]);
  const annotated = withAnnotations(merged);

  if (merged.length === 0) {
    console.error(
      `[mcp.tools/list] CRITICAL: zero tools discovered. registryError=${registryError || 'none'} registry=${registryTools.length} manifest=${manifestLegacy.length}`
    );
  } else {
    console.info(
      `[mcp.tools/list] discovered total=${merged.length} registry=${registryTools.length} manifest_extra=${manifestLegacy.length} supplemental=${supplemental.length} curated_filter=${curated}`
    );
  }

  cachedFullTools = sanitizeForClient
    ? annotated.map((tool) => ({
        ...tool,
        inputSchema: sanitizeToolSchemaForClient(tool.inputSchema),
      }))
    : annotated;

  cachedCuratedTools = cachedFullTools.filter((tool) => CURATED_TOOL_SET.has(tool.name));
  for (const alias of withAnnotations(DISCOVERY_ALIAS_TOOLS)) {
    if (!cachedCuratedTools.some((t) => t.name === alias.name)) {
      cachedCuratedTools.push({
        ...alias,
        inputSchema: sanitizeForClient
          ? sanitizeToolSchemaForClient(alias.inputSchema)
          : alias.inputSchema,
      });
    }
  }
  cachedCuratedTools.sort((a, b) => a.name.localeCompare(b.name));

  if (curated && cachedCuratedTools.length === 0 && cachedFullTools.length > 0) {
    console.error(
      `[mcp.tools/list] curated filter matched 0/${cachedFullTools.length} tools — falling back to full catalog`
    );
    cacheTime = now;
    return cachedFullTools;
  }

  cacheTime = now;
  const result = curated ? cachedCuratedTools : cachedFullTools;
  console.info(`[mcp.tools/list] returning catalog=${curated ? 'curated' : 'full'} count=${result.length}`);
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
  cacheTime = 0;
}

/** @deprecated Use getUnifiedMcpTools — kept for backward compatibility */
export async function listAllMcpTools() {
  return getUnifiedMcpTools();
}
