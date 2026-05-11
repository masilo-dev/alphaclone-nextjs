import { NextRequest, NextResponse } from 'next/server';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { createMCPServer } from '@/services/mcp/MCPServer';

export const dynamic = 'force-dynamic';

async function handleDiscovery(req: NextRequest, method: string) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const auth = await validateMCPAuthApp(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: getMcpCorsHeaders(req) });
  }

  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: getMcpCorsHeaders(req) });
  }

  try {
    if (method === 'prompts/list') {
      return NextResponse.json({ prompts: [] }, { headers: { ...getMcpCorsHeaders(req), 'X-MCP-Version': '2.0.0' } });
    }

    if (method === 'tools/list') {
      const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
      return NextResponse.json({ tools: MCP_TOOLS }, { headers: { ...getMcpCorsHeaders(req), 'X-MCP-Version': '2.0.0' } });
    }

    return NextResponse.json({ error: 'Method Not Supported' }, { status: 400, headers: getMcpCorsHeaders(req) });
  } catch (err) {
    console.error(`[MCP Discovery ${method}] Error:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: getMcpCorsHeaders(req) });
  }
}

export async function GET(req: NextRequest) {
  return handleDiscovery(req, 'prompts/list');
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
