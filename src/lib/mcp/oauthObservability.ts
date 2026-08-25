import { randomUUID } from 'crypto';

export type McpOAuthLogEvent =
  | 'mcp.oauth.token.requested'
  | 'mcp.oauth.token.failed'
  | 'mcp.oauth.pkce.validated'
  | 'mcp.oauth.code.consumed'
  | 'mcp.oauth.token.persisted'
  | 'mcp.oauth.token.issued';

export function createMcpOAuthRequestId(): string {
  return `mcp_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function logMcpOAuthEvent(params: {
  event: McpOAuthLogEvent | string;
  requestId: string;
  stage?: string;
  clientId?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  grantType?: string | null;
  errorClass?: string;
  errorCode?: string;
  durationMs?: number;
  encryptionSource?: string;
}): void {
  console.log(
    JSON.stringify({
      ...params,
      ts: new Date().toISOString(),
    }),
  );
}
