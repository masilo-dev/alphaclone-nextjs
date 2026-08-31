/**
 * External MCP Server Configuration Registry
 *
 * Registers third-party MCP servers for AlphaClone integrations.
 * Each server entry defines its transport (SSE or Stdio) and connection config.
 */

export type McpTransport = 'sse' | 'stdio';

export interface ExternalMcpServer {
  id: string;
  name: string;
  description: string;
  transport: McpTransport;
  /** For SSE transport: the URL endpoint */
  url?: string;
  /** For stdio transport: the command and args to run */
  command?: string;
  args?: string[];
  /** Environment variable names needed to activate this server */
  requiredEnvVars?: string[];
  enabled: boolean;
}

export const EXTERNAL_MCP_SERVERS: ExternalMcpServer[] = [
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Access Google Drive, Sheets, Docs, and Gmail via MCP.',
    transport: 'sse',
    url: process.env.GOOGLE_WORKSPACE_MCP_URL || 'https://mcp.googleapis.com/workspace/sse',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages, manage channels and read Slack history via MCP.',
    transport: 'sse',
    url: process.env.SLACK_MCP_URL || 'https://mcp.slack.com/api/sse',
    requiredEnvVars: ['SLACK_BOT_TOKEN'],
    enabled: !!process.env.SLACK_BOT_TOKEN,
  },
];

/**
 * Get all enabled external MCP servers.
 */
export function getEnabledExternalServers(): ExternalMcpServer[] {
  return EXTERNAL_MCP_SERVERS.filter(s => s.enabled);
}

/**
 * Get a specific external server by ID.
 */
export function getExternalServer(id: string): ExternalMcpServer | undefined {
  return EXTERNAL_MCP_SERVERS.find(s => s.id === id);
}
