// Global store for MCP sessions, required because SSE endpoints and message endpoints are polled separately.
// We intentionally keep the type broad because different MCP transport implementations are supported.
export const mcpTransports = new Map<string, any>();
