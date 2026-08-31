import type { UnifiedMcpTool } from '@/lib/mcp/listAllTools';
import { isChatGptConnectorClient, prioritizeToolsForChatGpt } from '@/lib/mcp/prioritizeChatGptTools';

export type McpCatalogMode = 'stable' | 'progressive' | 'full';

export type PaginateMcpToolsListInput = {
  tools: UnifiedMcpTool[];
  catalogMode: McpCatalogMode;
  clientId?: string | null;
  rawCursor?: string | null;
  rawLimit?: string | number | null;
};

export type PaginateMcpToolsListResult = {
  tools: UnifiedMcpTool[];
  offset: number;
  limit: number;
  paginate: boolean;
  nextCursor?: string;
};

const MAX_PAGE_SIZE = 250;
const DEFAULT_NON_FULL_PAGE_SIZE = 75;

function parseOffset(rawCursor?: string | null): number {
  if (typeof rawCursor !== 'string' || rawCursor.trim() === '') return 0;
  const parsed = parseInt(rawCursor.trim(), 10);
  return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
}

function parseLimit(rawLimit?: string | number | null): number | null {
  if (rawLimit === undefined || rawLimit === null) return null;
  const parsed = parseInt(String(rawLimit).trim(), 10);
  return !isNaN(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_SIZE) : null;
}

/**
 * Shared tools/list pagination for POST /api/mcp and GET /api/mcp/tools.
 * ChatGPT connector (full catalog, first page): return the entire compact catalog
 * so Apps clients that ignore nextCursor still receive all executable tools.
 */
export function paginateMcpToolsList(input: PaginateMcpToolsListInput): PaginateMcpToolsListResult {
  const offset = parseOffset(input.rawCursor);
  const explicitLimit = parseLimit(input.rawLimit);
  const hasExplicitLimit = explicitLimit !== null;
  const hasCursor = typeof input.rawCursor === 'string' && input.rawCursor.trim() !== '';

  let discoveryTools = input.tools;
  if (isChatGptConnectorClient(input.clientId) && input.catalogMode === 'full') {
    discoveryTools = prioritizeToolsForChatGpt(discoveryTools);
  }

  const chatGptFullFirstPage =
    isChatGptConnectorClient(input.clientId) &&
    input.catalogMode === 'full' &&
    offset === 0;

  if (chatGptFullFirstPage) {
    return {
      tools: discoveryTools,
      offset: 0,
      limit: discoveryTools.length,
      paginate: false,
      nextCursor: undefined,
    };
  }

  const paginate =
    hasExplicitLimit ||
    (hasCursor && input.catalogMode !== 'full') ||
    (hasCursor && offset > 0);

  let limit = discoveryTools.length;
  if (hasExplicitLimit && explicitLimit !== null) {
    limit = explicitLimit;
  } else if (paginate && input.catalogMode !== 'full') {
    limit = DEFAULT_NON_FULL_PAGE_SIZE;
  } else if (hasCursor && input.catalogMode === 'full') {
    limit = Math.min(Math.max(discoveryTools.length - offset, 0), MAX_PAGE_SIZE);
  }

  const returnAllOnFirstFullPage =
    !paginate &&
    (!hasCursor || (input.catalogMode === 'full' && offset === 0 && !hasExplicitLimit));

  const paginatedTools = returnAllOnFirstFullPage
    ? discoveryTools
    : discoveryTools.slice(offset, offset + limit);

  const nextOffset = offset + paginatedTools.length;
  const nextCursor =
    (paginate || hasCursor) && nextOffset < discoveryTools.length
      ? String(nextOffset)
      : undefined;

  return {
    tools: paginatedTools,
    offset,
    limit,
    paginate: !returnAllOnFirstFullPage,
    nextCursor,
  };
}
