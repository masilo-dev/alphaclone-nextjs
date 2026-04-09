export const MCP_OAUTH_SCOPES = {
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

export function validateScopes(scopesString: string): MCPOAuthScope[] {
  if (!scopesString) return [];
  const parts = scopesString.split(' ');
  return parts.filter(scope => VALID_SCOPES.includes(scope as MCPOAuthScope)) as MCPOAuthScope[];
}
