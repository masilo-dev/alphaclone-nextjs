import { NextRequest, NextResponse } from 'next/server';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp } from '@/services/mcp/authMiddlewareApp';
import { createMCPServer } from '@/services/mcp/MCPServer';

export const dynamic = 'force-dynamic';

async function handleDiscovery(req: NextRequest, method: string) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const auth = await validateMCPAuthApp(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: MCP_CORS_HEADERS });
  }

  try {
    const mcpServer = createMCPServer({
      tenantId: auth.tenant_id,
      userId: auth.user_id,
      clientLabel: `discovery-${method}-app`,
    });

    const handlers = (mcpServer.server as any)._requestHandlers;
    const handler = handlers ? handlers.get(method) : null;

    if (!handler) {
      return NextResponse.json({ error: `${method} handler not initialized` }, { status: 500, headers: MCP_CORS_HEADERS });
    }

    const result = await handler({});
    return NextResponse.json(result, { headers: { ...MCP_CORS_HEADERS, 'X-MCP-Version': '2.0.0' } });
  } catch (err) {
    console.error(`[MCP Discovery ${method}] Error:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: MCP_CORS_HEADERS });
  }
}

export async function GET(req: NextRequest) {
  return handleDiscovery(req, 'prompts/list');
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}
