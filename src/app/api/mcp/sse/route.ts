import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/services/mcp/MCPServer';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

const MCP_PROTOCOL_VERSION = '2024-11-05';

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const auth = await validateMCPAuthApp(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
  }

  const { tenant_id, user_id, apiKey, supabaseAdmin } = auth;

  // Update last used timestamp
  await supabaseAdmin
    .from('mcp_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key', apiKey);

  // Create a session record
  await supabaseAdmin
    .from('mcp_sessions')
    .insert({ tenant_id, user_id, metadata: { client_label: 'sse-handshake-app' } });

  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host');
  const endpointUrl = `${protocol}://${host}/api/mcp/messages?api_key=${encodeURIComponent(apiKey)}`;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':\n\n'));
        } catch (e) {
          clearInterval(heartbeat);
          controller.close();
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      ...MCP_CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    },
  });
}

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
      error: { code: -32600, message: 'Invalid Request: missing method' },
      id: requestBody?.id ?? null,
    }, { status: 400, headers: MCP_CORS_HEADERS });
  }

  const method: string = requestBody.method;

  // 1. Special case: initialize
  if (method === 'initialize') {
    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
    }

    const { tenant_id, user_id, supabaseAdmin } = auth;

    const { data: sessionRow } = await supabaseAdmin
      .from('mcp_sessions')
      .insert({
        tenant_id,
        user_id,
        metadata: {
          client_label: requestBody.params?.clientInfo?.name || 'claude-app',
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

  // 2. All other methods
  const mcpSessionId = req.headers.get('mcp-session-id');
  let tenantId: string;
  let userId: string;

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
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found. Send a new initialize request.' },
        id: requestBody.id ?? null,
      }, { status: 404, headers: MCP_CORS_HEADERS });
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session expired. Send a new initialize request.' },
        id: requestBody.id ?? null,
      }, { status: 404, headers: MCP_CORS_HEADERS });
    }

    tenantId = session.tenant_id;
    userId = session.user_id;
  } else {
    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
    }
    tenantId = auth.tenant_id;
    userId = auth.user_id;
  }

  // Execute
  try {
    const mcpServer = createMCPServer({
      tenantId,
      userId,
      clientLabel: req.headers.get('x-client-label') || 'mcp-client-app',
    });

    const handlers = (mcpServer.server as any)._requestHandlers;
    const methodHandler = handlers ? handlers.get(method) : null;

    if (!methodHandler) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
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
    console.error('[MCP SSE POST App] Execution failed:', err);
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
