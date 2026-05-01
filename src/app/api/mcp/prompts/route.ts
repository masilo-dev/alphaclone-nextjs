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
    if (method === 'prompts/list') {
      return NextResponse.json({ prompts: [] }, { headers: { ...MCP_CORS_HEADERS, 'X-MCP-Version': '2.0.0' } });
    }

    if (method === 'tools/list') {
      const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
      return NextResponse.json({ tools: MCP_TOOLS }, { headers: { ...MCP_CORS_HEADERS, 'X-MCP-Version': '2.0.0' } });
    }

    return NextResponse.json({ error: 'Method Not Supported' }, { status: 400, headers: MCP_CORS_HEADERS });
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
