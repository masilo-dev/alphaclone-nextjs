import { NextRequest, NextResponse } from 'next/server';
import { MCP_CORS_HEADERS, handleCorsApp } from '@/services/mcp/authMiddlewareApp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  return NextResponse.json({
    ok: true,
    service: 'mcp',
    transport: 'streamable-http',
    protocol_version: '2024-11-05',
    endpoint: '/api/mcp/sse',
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      ...MCP_CORS_HEADERS,
      'MCP-Protocol-Version': '2024-11-05',
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}
