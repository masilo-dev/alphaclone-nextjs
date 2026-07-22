/**
 * MCP / OAuth scope registry. Unknown scopes grant nothing (fail closed).
 */
export const MCP_SCOPES = {
  READ: 'read',
  WRITE: 'write',
  TOOLS: 'mcp:tools',
  RESOURCES: 'mcp:resources',
} as const;

export type McpScope = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES];

export const ALL_MCP_SCOPES: readonly McpScope[] = Object.values(MCP_SCOPES);

const KNOWN = new Set<string>(ALL_MCP_SCOPES);

/** Filter to known scopes only. */
export function sanitizeScopes(scopes: string[] | null | undefined): McpScope[] {
  if (!scopes?.length) return [MCP_SCOPES.READ, MCP_SCOPES.WRITE];
  return scopes.filter((s): s is McpScope => KNOWN.has(s));
}

/** Space-separated scope string for OAuth token responses. */
export function formatScopeString(scopes: string[] | null | undefined): string {
  return sanitizeScopes(scopes).join(' ');
}

/**
 * Default tool → required scopes map.
 * Possession of any valid token does NOT imply permission for every tool.
 */
export const MCP_TOOL_REQUIRED_SCOPES: Record<string, McpScope[]> = {
  // Read + tools
  get_clients: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  list_leads: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  search_leads: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  search_documents: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  get_platform_status: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  get_system_health: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  get_whatsapp_status: [MCP_SCOPES.READ, MCP_SCOPES.TOOLS],
  // Write + tools
  create_client: [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
  create_lead: [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
  update_lead: [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
  delete_lead: [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
  create_invoice: [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
  publish_post: [MCP_SCOPES.WRITE, MCP_SCOPES.TOOLS],
  // Resources
  'resources/list': [MCP_SCOPES.READ, MCP_SCOPES.RESOURCES],
  'resources/read': [MCP_SCOPES.READ, MCP_SCOPES.RESOURCES],
};

export function requiredScopesForTool(toolName: string): McpScope[] {
  return MCP_TOOL_REQUIRED_SCOPES[toolName] ?? [MCP_SCOPES.READ, MCP_SCOPES.TOOLS];
}

export function hasRequiredScopes(
  tokenScopes: string[] | null | undefined,
  required: string[]
): { valid: boolean; missing: string[] } {
  if (!required.length) return { valid: true, missing: [] };
  const held = new Set(sanitizeScopes(tokenScopes));
  // Legacy tokens with only read/write still cover tools/resources when both present
  if (held.has(MCP_SCOPES.READ) && held.has(MCP_SCOPES.WRITE)) {
    held.add(MCP_SCOPES.TOOLS);
    held.add(MCP_SCOPES.RESOURCES);
  }
  const missing = required.filter((s) => !held.has(s as McpScope) && !held.has(s));
  return { valid: missing.length === 0, missing };
}
