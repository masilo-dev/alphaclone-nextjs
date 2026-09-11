import { NextRequest, NextResponse } from 'next/server';
import { handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  return NextResponse.json({
    ok: true,
    service: 'mcp',
    transport: 'streamable-http',
    protocol_version: '2025-11-25',
    /** Canonical Streamable HTTP endpoint for all MCP clients */
    endpoint: '/api/mcp',
    resource: PUBLIC_MCP_RESOURCE,
    /** Legacy SSE companion (optional) */
    sse_endpoint: '/api/mcp/sse',
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      ...getMcpCorsHeaders(req),
      'MCP-Protocol-Version': '2025-11-25',
      'x-mcp-version': '2025-11-25',
      'Cache-Control': 'no-store',
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
