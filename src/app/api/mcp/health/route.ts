import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { PUBLIC_MCP_RESOURCE } from '@/lib/config/public-origin';
=======
import { MCP_CORS_HEADERS, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  return NextResponse.json({
    ok: true,
    service: 'mcp',
    transport: 'streamable-http',
    protocol_version: '2025-11-25',
<<<<<<< HEAD
    /** Canonical Streamable HTTP endpoint for all MCP clients */
    endpoint: '/api/mcp',
    resource: PUBLIC_MCP_RESOURCE,
    /** Legacy SSE companion (optional) */
    sse_endpoint: '/api/mcp/sse',
=======
    endpoint: '/api/mcp/sse',
>>>>>>> origin/main
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      ...getMcpCorsHeaders(req),
      'MCP-Protocol-Version': '2025-11-25',
      'x-mcp-version': '2025-11-25',
<<<<<<< HEAD
      'Cache-Control': 'no-store',
=======
>>>>>>> origin/main
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
