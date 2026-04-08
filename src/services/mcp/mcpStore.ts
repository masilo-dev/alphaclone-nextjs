import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Global store for MCP sessions, required because SSE endpoints and Message endpoints are polled separately
export const mcpTransports = new Map<string, SSEServerTransport>();
