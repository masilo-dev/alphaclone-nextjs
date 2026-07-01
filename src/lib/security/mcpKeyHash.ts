import { createHash, randomBytes } from 'crypto';

const MCP_KEY_PREFIX = 'ac_mcp_';

export function generateMcpApiKey(): string {
  return `${MCP_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
}

export function hashMcpApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function isMcpApiKeyFormat(value: string): boolean {
  return value.startsWith(MCP_KEY_PREFIX) && value.length > 20;
}
