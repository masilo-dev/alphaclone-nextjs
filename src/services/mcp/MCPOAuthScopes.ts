export const MCP_OAUTH_SCOPES = {
  READ_ALL: 'read:all',
  WRITE_ALL: 'write:all',
  READ_DEALS: 'read:deals',
  WRITE_DEALS: 'write:deals',
  WRITE_LEADS: 'write:leads',
  UPDATE_TASKS: 'update:tasks',
  READ_PROJECTS: 'read:projects', // or 'projects' as requested
  WRITE_PROJECTS: 'write:projects',
  UPDATE_STAGES: 'update:stages',
  CHECK_CALENDAR: 'check:calendar',
} as const;

export type MCPOAuthScope = typeof MCP_OAUTH_SCOPES[keyof typeof MCP_OAUTH_SCOPES];

export const VALID_SCOPES: MCPOAuthScope[] = Object.values(MCP_OAUTH_SCOPES);

const FULL_ACCESS_SCOPE_SET: ReadonlySet<MCPOAuthScope> = new Set([
  MCP_OAUTH_SCOPES.READ_DEALS,
  MCP_OAUTH_SCOPES.WRITE_DEALS,
  MCP_OAUTH_SCOPES.WRITE_LEADS,
  MCP_OAUTH_SCOPES.UPDATE_TASKS,
  MCP_OAUTH_SCOPES.READ_PROJECTS,
  MCP_OAUTH_SCOPES.WRITE_PROJECTS,
  MCP_OAUTH_SCOPES.UPDATE_STAGES,
  MCP_OAUTH_SCOPES.CHECK_CALENDAR,
]);

export const MCP_SCOPE_LABELS: Record<MCPOAuthScope, string> = {
  [MCP_OAUTH_SCOPES.READ_ALL]: 'Read all business workspace data',
  [MCP_OAUTH_SCOPES.WRITE_ALL]: 'Write and update all business workspace data',
  [MCP_OAUTH_SCOPES.READ_DEALS]: 'Read deals',
  [MCP_OAUTH_SCOPES.WRITE_DEALS]: 'Write deals',
  [MCP_OAUTH_SCOPES.WRITE_LEADS]: 'Write leads',
  [MCP_OAUTH_SCOPES.UPDATE_TASKS]: 'Update tasks',
  [MCP_OAUTH_SCOPES.READ_PROJECTS]: 'Read projects',
  [MCP_OAUTH_SCOPES.WRITE_PROJECTS]: 'Write projects',
  [MCP_OAUTH_SCOPES.UPDATE_STAGES]: 'Update stages',
  [MCP_OAUTH_SCOPES.CHECK_CALENDAR]: 'Check calendar',
};

function dedupeScopes(scopes: MCPOAuthScope[]): MCPOAuthScope[] {
  return Array.from(new Set(scopes));
}

export function validateScopes(scopesString: string): MCPOAuthScope[] {
  if (!scopesString) return [];
  const parts = scopesString
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);
  const valid = parts.filter((scope) => VALID_SCOPES.includes(scope as MCPOAuthScope)) as MCPOAuthScope[];
  const hasReadAll = valid.includes(MCP_OAUTH_SCOPES.READ_ALL);
  const hasWriteAll = valid.includes(MCP_OAUTH_SCOPES.WRITE_ALL);
  if (hasReadAll || hasWriteAll) {
    return dedupeScopes([
      ...(hasReadAll ? [MCP_OAUTH_SCOPES.READ_ALL] : []),
      ...(hasWriteAll ? [MCP_OAUTH_SCOPES.WRITE_ALL] : []),
      ...Array.from(FULL_ACCESS_SCOPE_SET),
    ]);
  }
  return dedupeScopes(valid);
}
