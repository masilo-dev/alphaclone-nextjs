import { NextRequest, NextResponse } from 'next/server';
import { validateMCPAuthApp, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { resolveUnifiedCatalogMode } from '@/lib/mcp/ensureOAuthClient';
import { paginateMcpToolsList } from '@/lib/mcp/toolsListPagination';

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
      const clientId = auth.client_id || null;
      const catalogMode = resolveUnifiedCatalogMode(clientId);
      const tools = await getUnifiedMcpTools({ clientId, catalogMode });
      const checksum = getCatalogChecksum(tools);

      const rawCursor = req.nextUrl.searchParams.get('cursor');
      const rawLimit = req.nextUrl.searchParams.get('limit') || req.nextUrl.searchParams.get('pageSize');
      const pagination = paginateMcpToolsList({
        tools,
        catalogMode,
        clientId,
        rawCursor,
        rawLimit,
      });

      const responsePayload: Record<string, unknown> = {
        tools: pagination.tools,
        metadata: {
          registry_version: '2.0.0',
          catalog_checksum: checksum,
          total_tools: tools.length,
          returned_tools: pagination.tools.length,
          catalog_mode: catalogMode,
          offset: pagination.offset,
          next_cursor: pagination.nextCursor || null,
        },
      };

      if (pagination.nextCursor) {
        responsePayload.nextCursor = pagination.nextCursor;
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
