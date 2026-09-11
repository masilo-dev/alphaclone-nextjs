import { ENV } from '@/config/env';

export interface McpToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

/**
 * Helper to call MCP tools from the frontend
 */
export async function callMcpTool(
  method: string,
  args: Record<string, any>,
  options: { sessionId?: string; clientLabel?: string } = {}
): Promise<McpToolResponse> {
  const response = await fetch('/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'mcp-session-id': options.sessionId || '',
      'x-client-label': options.clientLabel || 'frontend-dashboard',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Math.random().toString(36).substring(7),
      method: 'tools/call',
      params: {
        name: method,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.result;
}
