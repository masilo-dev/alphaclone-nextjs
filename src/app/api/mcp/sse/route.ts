import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/services/mcp/MCPServer';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { StatelessTransport } from '@/services/mcp/StatelessTransport';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const MCP_PROTOCOL_VERSION = '2025-11-25';

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
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hour session
  await supabaseAdmin
    .from('mcp_sessions')
    .insert({ 
      tenant_id, 
      user_id, 
      expires_at: expiresAt,
      metadata: { client_label: 'sse-handshake-app' } 
    });

  const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0] ?? 'https';
  const host = req.headers.get('host') ?? '';
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

  return new Response(stream, {
    headers: {
      ...MCP_CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform, must-revalidate',
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

  const mcpSessionId = req.headers.get('mcp-session-id');
  let tenantId = '';
  let userId = '';

  // Handle Authentication for all methods
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
    // Stateless fallback using api_key (e.g. for simple HTTP transport clients or initialize method)
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

  try {
    const mcpServer = createMCPServer({
      tenantId,
      userId,
      clientLabel: req.headers.get('x-client-label') || 'mcp-client-app',
    });

    const transport = new StatelessTransport();
    await mcpServer.server.connect(transport);

    if (ENV.NODE_ENV !== 'production') {
      console.log(`[MCP SSE POST] Passing method: ${requestBody.method} to SDK (Tenant: ${tenantId})`);
    }

    if (transport.onmessage) {
      // Feed the incoming message to the official SDK loop
      transport.onmessage(requestBody);
    }

    // Wait for the SDK to emit a response
    const responseMessage = await transport.getResponse(10000);

    if (!responseMessage) {
      // No response generated (e.g. for notifications)
      return new NextResponse(null, { status: 202, headers: MCP_CORS_HEADERS });
    }

    const headers = new Headers({
      ...MCP_CORS_HEADERS,
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    });

    // If it was an initialize request, generate a new session ID for subsequent requests
    if (requestBody.method === 'initialize' && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hour session
      const { data: sessionRow } = await supabaseAdmin
        .from('mcp_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          expires_at: expiresAt,
          metadata: {
            client_label: requestBody.params?.clientInfo?.name || 'mcp-sse-app',
            protocol_version: requestBody.params?.protocolVersion || MCP_PROTOCOL_VERSION,
          },
        })
        .select('id')
        .single();

      if (sessionRow?.id) {
        headers.set('Mcp-Session-Id', sessionRow.id);
      }
    }

    return NextResponse.json(responseMessage, { headers });
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
