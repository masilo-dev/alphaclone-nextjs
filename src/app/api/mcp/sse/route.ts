import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/services/mcp/MCPServer';
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { StatelessTransport } from '@/services/mcp/StatelessTransport';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const MCP_PROTOCOL_VERSION = '2025-11-25';

export async function GET(req: NextRequest) {
  try {
    const cors = handleCorsApp(req);
    if (cors) return cors;

    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
      console.warn('[MCP SSE GET] Auth failed:', auth.error);
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: MCP_CORS_HEADERS });
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

    const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0] ?? 'https';
    const host = req.headers.get('host') ?? '';
    const endpointUrl = `${protocol}://${host}/api/mcp/messages?api_key=${encodeURIComponent(apiKey)}`;

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
        ...MCP_CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform, must-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
    });
  } catch (err) {
    console.error('[MCP SSE GET] Fatal handshake error:', err);
    return NextResponse.json({ error: 'Internal connection error' }, { status: 500, headers: MCP_CORS_HEADERS });
  }
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: MCP_CORS_HEADERS });
}
