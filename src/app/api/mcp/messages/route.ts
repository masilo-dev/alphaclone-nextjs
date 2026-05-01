import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/services/mcp/MCPServer';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

const MCP_PROTOCOL_VERSION = '2024-11-05';

export async function POST(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  let requestBody: any;
  try {
    requestBody = await req.json();
  } catch (e) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null,
    }, { status: 400, headers: MCP_CORS_HEADERS });
  }

  if (!requestBody || typeof requestBody !== 'object' || !requestBody.method) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: requestBody?.id ?? null,
    }, { status: 400, headers: MCP_CORS_HEADERS });
  }

  const mcpSessionId = req.headers.get('mcp-session-id');
  let tenantId = '';
  let userId = '';

  // 1. Special case: initialize
  if (requestBody.method === 'initialize') {
    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
    }

    const { tenant_id, user_id, supabaseAdmin } = auth;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hour session

    const { data: sessionRow } = await supabaseAdmin
      .from('mcp_sessions')
      .insert({
        tenant_id,
        user_id,
        expires_at: expiresAt,
        metadata: {
          client_label: requestBody.params?.clientInfo?.name || 'mcp-messages-app',
          protocol_version: requestBody.params?.protocolVersion || MCP_PROTOCOL_VERSION,
        },
      })
      .select('id')
      .single();

    const sessionId = sessionRow?.id;
    
    const response = NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: 'AlphaClone-MCP',
          version: '2.0.0',
        },
      },
    }, { headers: MCP_CORS_HEADERS });

    if (sessionId) {
      response.headers.set('Mcp-Session-Id', sessionId);
    }
    response.headers.set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);

    return response;
  }

  // 2. All other methods - handle session or stateless fallback
  if (mcpSessionId) {
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SERVER_CONFIGURATION_ERROR' }, { status: 500, headers: MCP_CORS_HEADERS });
    }
    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mcp_sessions')
      .select('tenant_id, user_id, expires_at')
      .eq('id', mcpSessionId)
      .single();

    if (sessionError || !session) {
      // Session not found, but let's try a stateless fallback if possible
      const auth = await validateMCPAuthApp(req);
      if ('error' in auth) {
        return NextResponse.json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'MCP session not found and no valid API key provided. Please re-initialize.' },
          id: requestBody.id ?? null,
        }, { status: 404, headers: MCP_CORS_HEADERS });
      }
      tenantId = auth.tenant_id;
      userId = auth.user_id;
    } else {
      const expiry = session.expires_at ? new Date(session.expires_at) : new Date(0);
      if (expiry < new Date()) {
        // Session expired, fallback to api_key if possible
        const auth = await validateMCPAuthApp(req);
        if ('error' in auth) {
          return NextResponse.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'MCP session expired and no valid API key provided. Please re-initialize.' },
            id: requestBody.id ?? null,
          }, { status: 404, headers: MCP_CORS_HEADERS });
        }
        tenantId = auth.tenant_id;
        userId = auth.user_id;
      } else {
        tenantId = session.tenant_id;
        userId = session.user_id;
      }
    }
  } else {
    // Stateless fallback using api_key (e.g. for simple HTTP transport clients)
    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
    }
    tenantId = auth.tenant_id;
    userId = auth.user_id;
  }

  if (!tenantId || !userId) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Authentication failed: missing tenant or user context' },
      id: requestBody.id ?? null,
    }, { status: 401, headers: MCP_CORS_HEADERS });
  }

  // Handle Notifications (null ID)
  if (requestBody.id === null || requestBody.id === undefined) {
    // For now, we just acknowledge notifications with 202 or 200
    return new NextResponse(null, { status: 202, headers: MCP_CORS_HEADERS });
  }

  try {
    const mcpServer = createMCPServer({
      tenantId,
      userId,
      clientLabel: req.headers.get('x-client-label') || 'mcp-messages-app',
    });

    const method = requestBody.method;
    const handlers = (mcpServer.server as any)._requestHandlers;
    if (ENV.NODE_ENV !== 'production') {
      console.log(`[MCP Messages] Handler lookup: ${method} (Tenant: ${tenantId})`);
    }
    const methodHandler = handlers?.get(method);

    if (!methodHandler) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `MCP Method not found: ${method}` },
        id: requestBody.id ?? null,
      }, { status: 404, headers: MCP_CORS_HEADERS });
    }

    const result = await methodHandler(requestBody);

    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result,
    }, { headers: { ...MCP_CORS_HEADERS, 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION } });
  } catch (err) {
    console.error('[MCP Messages POST App] Execution failed:', err);
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal Server Error' },
      id: requestBody?.id ?? null,
    }, { status: 500, headers: MCP_CORS_HEADERS });
  }

}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}
