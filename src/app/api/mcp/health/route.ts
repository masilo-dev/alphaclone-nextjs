import { NextRequest, NextResponse } from 'next/server';
import { MCP_CORS_HEADERS, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  return NextResponse.json({
    ok: true,
    service: 'mcp',
    transport: 'streamable-http',
    protocol_version: '2025-11-25',
    endpoint: '/api/mcp/sse',
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      ...getMcpCorsHeaders(req),
      'MCP-Protocol-Version': '2025-11-25',
      'x-mcp-version': '2025-11-25',
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
