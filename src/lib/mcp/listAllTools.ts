import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { sanitizeToolSchemaForClient } from '@/lib/mcp/sanitizeToolSchema';
import { SUPPLEMENTAL_MCP_TOOLS, type McpDiscoveryTool } from '@/lib/mcp/supplementalToolDefinitions';
import {
  CHATGPT_CONNECTOR_TOOL_NAMES,
  isChatgptClient,
  resolveToolAnnotations,
} from '@/lib/mcp/toolAnnotations';

export type UnifiedMcpTool = McpDiscoveryTool;

let cachedFullTools: UnifiedMcpTool[] | null = null;
let cachedChatgptTools: UnifiedMcpTool[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

const CHATGPT_TOOL_SET = new Set<string>(CHATGPT_CONNECTOR_TOOL_NAMES);

/** Minimal ChatGPT aliases expected by some connector modes. */
const CHATGPT_ALIAS_TOOLS: UnifiedMcpTool[] = [
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
 * Single source of truth for MCP tool discovery across Bonnie, /api/mcp, and MCPServer.
 * Priority: registry handlers → legacy manifest → supplemental definitions.
 * Always attaches OpenAI-required annotations (readOnlyHint/openWorldHint/destructiveHint).
 */
export async function getUnifiedMcpTools(options?: {
  sanitizeForClient?: boolean;
  forceRefresh?: boolean;
  /** Prefer a curated ChatGPT connector catalog when true or when client hints match ChatGPT. */
  forChatGPT?: boolean;
  clientId?: string | null;
  clientLabel?: string | null;
  userAgent?: string | null;
}): Promise<UnifiedMcpTool[]> {
  const sanitizeForClient = options?.sanitizeForClient ?? true;
  const chatgpt =
    options?.forChatGPT === true ||
    isChatgptClient({
      clientId: options?.clientId,
      clientLabel: options?.clientLabel,
      userAgent: options?.userAgent,
    });
  const now = Date.now();

  if (
    !options?.forceRefresh &&
    now - cacheTime < CACHE_TTL_MS &&
    cachedFullTools &&
    (!chatgpt || cachedChatgptTools)
  ) {
    return chatgpt ? cachedChatgptTools! : cachedFullTools;
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
  const aliases = CHATGPT_ALIAS_TOOLS.filter(
    (t) =>
      !registryNames.has(t.name) &&
      !manifestLegacy.some((m) => m.name === t.name) &&
      !supplemental.some((m) => m.name === t.name)
  );

  const merged = dedupeTools([...registryTools, ...manifestLegacy, ...supplemental, ...aliases]);
  const annotated = withAnnotations(merged);

  cachedFullTools = sanitizeForClient
    ? annotated.map((tool) => ({
        ...tool,
        inputSchema: sanitizeToolSchemaForClient(tool.inputSchema),
      }))
    : annotated;

  cachedChatgptTools = cachedFullTools.filter((tool) => CHATGPT_TOOL_SET.has(tool.name));
  for (const alias of withAnnotations(CHATGPT_ALIAS_TOOLS)) {
    if (!cachedChatgptTools.some((t) => t.name === alias.name)) {
      cachedChatgptTools.push({
        ...alias,
        inputSchema: sanitizeForClient
          ? sanitizeToolSchemaForClient(alias.inputSchema)
          : alias.inputSchema,
      });
    }
  }
  cachedChatgptTools.sort((a, b) => a.name.localeCompare(b.name));
  cacheTime = now;

  return chatgpt ? cachedChatgptTools : cachedFullTools;
}

export async function getUnifiedMcpToolCount(options?: {
  forChatGPT?: boolean;
}): Promise<number> {
  const tools = await getUnifiedMcpTools(options);
  return tools.length;
}

export function invalidateUnifiedMcpToolCache(): void {
  cachedFullTools = null;
  cachedChatgptTools = null;
  cacheTime = 0;
}

/** @deprecated Use getUnifiedMcpTools — kept for backward compatibility */
export async function listAllMcpTools() {
  return getUnifiedMcpTools();
}
