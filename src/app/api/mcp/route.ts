import { NextRequest, NextResponse } from 'next/server';
import { validateMCPAuthApp, getMcpCorsHeaders, handleCorsApp } from '@/services/mcp/authMiddlewareApp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

const MCP_PROTOCOL_VERSION = '2025-03-26';

export async function POST(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const auth = await validateMCPAuthApp(req);
  if ('error' in auth) {
    return NextResponse.json(
      { error: auth.error }, 
      { status: auth.status, headers: getMcpCorsHeaders(req) }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' }, 
      { status: 400, headers: getMcpCorsHeaders(req) }
    );
  }

  // Handle initialize method directly for Streamable HTTP pattern
  if (body.method === 'initialize') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: { name: 'alphaclone', version: '1.0.0' },
        capabilities: {
          tools: { listChanged: false },
        },
      },
    }, { headers: getMcpCorsHeaders(req) });
  }

  // Forward everything else to your existing messages handler
  // This ensures we reuse the logic in the established messages endpoint
  const upstream = await fetch(
    `${req.nextUrl.origin}/api/mcp/messages${new URL(req.url).search}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': req.nextUrl.searchParams.get('api_key') || '',
      },
      body: JSON.stringify(body),
    }
  );

  try {
    const data = await upstream.json();
    return NextResponse.json(data, { 
      status: upstream.status,
      headers: getMcpCorsHeaders(req) 
    });
  } catch (err) {
    console.error('[MCP Single Endpoint] Upstream error:', err);
    return NextResponse.json(
      { error: 'Upstream processing failed' }, 
      { status: 502, headers: getMcpCorsHeaders(req) }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || 
    new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
