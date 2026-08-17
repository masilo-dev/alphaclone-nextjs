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
    if (method === 'tools/list') {
      const { getUnifiedMcpTools, getCatalogChecksum } = await import('@/lib/mcp/listAllTools');
      const tools = await getUnifiedMcpTools({ catalogMode: 'full' });
      const checksum = getCatalogChecksum(tools);

      const rawCursor = req.nextUrl.searchParams.get('cursor');
      const rawLimit = req.nextUrl.searchParams.get('limit') || req.nextUrl.searchParams.get('pageSize');
      const hasPaginationArgs = rawCursor !== null || rawLimit !== null;

      let offset = 0;
      if (typeof rawCursor === 'string' && rawCursor.trim() !== '') {
        const parsed = parseInt(rawCursor.trim(), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          offset = parsed;
        }
      }

      let limit = tools.length;
      if (rawLimit !== null) {
        const parsedLimit = parseInt(String(rawLimit).trim(), 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = Math.min(parsedLimit, 250);
        }
      } else if (hasPaginationArgs) {
        limit = 75;
      }

      const paginatedTools = hasPaginationArgs ? tools.slice(offset, offset + limit) : tools;
      const nextOffset = offset + paginatedTools.length;
      const nextCursor = (hasPaginationArgs && nextOffset < tools.length) ? String(nextOffset) : undefined;

      const responsePayload: Record<string, unknown> = {
        tools: paginatedTools,
        metadata: {
          registry_version: '2.0.0',
          catalog_checksum: checksum,
          total_tools: tools.length,
          returned_tools: paginatedTools.length,
          offset,
          next_cursor: nextCursor || null,
        },
      };

      if (nextCursor) {
        responsePayload.nextCursor = nextCursor;
      }

      return NextResponse.json(
        responsePayload,
        {
          headers: {
            ...getMcpCorsHeaders(req),
            'X-MCP-Version': '2.0.0',
            'X-Catalog-Checksum': checksum,
          },
        }
      );
    }

    if (method === 'resources/list') {
      return NextResponse.json({ resources: [] }, { headers: { ...getMcpCorsHeaders(req), 'X-MCP-Version': '2.0.0' } });
    }

    if (method === 'prompts/list') {
      return NextResponse.json({ prompts: [] }, { headers: { ...getMcpCorsHeaders(req), 'X-MCP-Version': '2.0.0' } });
    }

    return NextResponse.json({ error: 'Method Not Supported' }, { status: 400, headers: getMcpCorsHeaders(req) });
  } catch (err) {
    console.error(`[MCP Discovery ${method}] Error:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: getMcpCorsHeaders(req) });
  }
}

export async function GET(req: NextRequest) {
  return handleDiscovery(req, 'tools/list');
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
