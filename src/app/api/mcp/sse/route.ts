import { NextRequest, NextResponse } from 'next/server';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const MCP_PROTOCOL_VERSION = '2025-11-25';

function getBaseUrl(req: NextRequest) {
  const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0] ?? 'https';
  const host = req.headers.get('x-forwarded-host')?.split(',')[0] ?? req.headers.get('host') ?? '';
  return `${protocol}://${host}`;
}

function buildForwardHeaders(req: NextRequest) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': req.headers.get('mcp-protocol-version') || req.headers.get('x-mcp-version') || MCP_PROTOCOL_VERSION,
  });

  const passthroughHeaders = [
    'authorization',
    'x-api-key',
    'mcp-session-id',
    'x-client-label',
    'x-mcp-version',
  ];

  for (const headerName of passthroughHeaders) {
    const value = req.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const cors = handleCorsApp(req);
    if (cors) return cors;

    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
      console.warn('[MCP SSE GET] Auth failed:', auth.error);
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: getMcpCorsHeaders(req) });
    }

    const { tenant_id, user_id, apiKey, supabaseAdmin } = auth;
    console.log(`[MCP SSE GET] Connection attempt for tenant: ${tenant_id}`);

    // Update last used timestamp (fire and forget)
    void supabaseAdmin
      .from('mcp_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', apiKey);

    // Create a session record
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hour session
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('mcp_sessions')
      .insert({ 
        tenant_id, 
        user_id, 
        expires_at: expiresAt,
        metadata: { client_label: 'sse-handshake-app' } 
      })
      .select('id')
      .single();

    if (sessionError) {
        console.error('[MCP SSE GET] Failed to create session:', sessionError);
        // We continue anyway, as basic SSE might still work for some clients
    }

    const endpointUrl = `${getBaseUrl(req)}/api/mcp/messages?api_key=${encodeURIComponent(apiKey)}`;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        try {
            controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));
            if (sessionData?.id) {
                controller.enqueue(encoder.encode(`event: session\ndata: ${sessionData.id}\n\n`));
            }
        } catch (err) {
            console.error('[MCP SSE GET] Initial stream enqueue failed:', err);
        }

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(':\n\n'));
          } catch (e) {
            clearInterval(heartbeat);
            try { controller.close(); } catch {}
          }
        }, 15000);

        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        ...getMcpCorsHeaders(req),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
    });
  } catch (err) {
    console.error('[MCP SSE GET] Fatal handshake error:', err);
    return NextResponse.json({ error: 'Internal connection error' }, { status: 500, headers: getMcpCorsHeaders(req) });
  }
}

export async function POST(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  let bodyText = '';
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: getMcpCorsHeaders(req) });
  }

  const upstream = await fetch(`${getBaseUrl(req)}/api/mcp/messages${new URL(req.url).search}`, {
    method: 'POST',
    headers: buildForwardHeaders(req),
    body: bodyText,
  });

  const responseHeaders = new Headers(getMcpCorsHeaders(req));
  responseHeaders.set('MCP-Protocol-Version', upstream.headers.get('MCP-Protocol-Version') || MCP_PROTOCOL_VERSION);

  const exposedHeaders = ['Mcp-Session-Id', 'Content-Type', 'x-mcp-version'];
  for (const headerName of exposedHeaders) {
    const value = upstream.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function DELETE(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const sessionId = req.headers.get('mcp-session-id');
  if (sessionId && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      await supabaseAdmin.from('mcp_sessions').delete().eq('id', sessionId);
    } catch (err) {
      console.warn('[MCP SSE DELETE] Session cleanup failed:', err);
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getMcpCorsHeaders(req),
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
