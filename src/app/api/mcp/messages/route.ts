import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/services/mcp/MCPServer';
<<<<<<< HEAD
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp, getMcpCorsHeaders, createUnauthorizedResponse } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { getInitialBusinessAIStateForTenant } from '@/lib/mcp/getInitialBusinessAIStateForTenant';
=======
import { validateMCPAuthApp, MCP_CORS_HEADERS, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
>>>>>>> origin/main
import { StatelessTransport } from '@/services/mcp/StatelessTransport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

<<<<<<< HEAD
const MCP_PROTOCOL_VERSION = '2025-11-25';
=======
const MCP_PROTOCOL_VERSION = '2025-03-26';
>>>>>>> origin/main

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
    }, { status: 400, headers: getMcpCorsHeaders(req) });
  }

  if (!requestBody || typeof requestBody !== 'object' || !requestBody.method) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: requestBody?.id ?? null,
    }, { status: 400, headers: getMcpCorsHeaders(req) });
  }

  const mcpSessionId = req.headers.get('mcp-session-id');
  let tenantId = '';
  let userId = '';
<<<<<<< HEAD
  let authClientId: string | null = null;
=======
>>>>>>> origin/main

  // Handle Authentication for all methods
  if (mcpSessionId) {
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SERVER_CONFIGURATION_ERROR' }, { status: 500, headers: getMcpCorsHeaders(req) });
    }
    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: {
          'Accept': 'application/json',
          'X-Client-Info': 'mcp-messages-endpoint-v2'
        }
      }
    });
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mcp_sessions')
<<<<<<< HEAD
      .select('tenant_id, user_id, expires_at, metadata')
=======
      .select('tenant_id, user_id, expires_at')
>>>>>>> origin/main
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
        }, { status: 404, headers: getMcpCorsHeaders(req) });
      }
      tenantId = auth.tenant_id;
      userId = auth.user_id;
<<<<<<< HEAD
      authClientId = auth.client_id || null;
    } else {
      const expiry = session.expires_at ? new Date(session.expires_at) : new Date(0);
      const meta = (session.metadata || {}) as Record<string, unknown>;
      if (typeof meta.client_id === 'string') authClientId = meta.client_id;
=======
    } else {
      const expiry = session.expires_at ? new Date(session.expires_at) : new Date(0);
>>>>>>> origin/main
      if (expiry < new Date()) {
        // Session expired, fallback to api_key if possible
        const auth = await validateMCPAuthApp(req);
        if ('error' in auth) {
          return NextResponse.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'MCP session expired and no valid API key provided. Please re-initialize.' },
            id: requestBody.id ?? null,
          }, { status: 404, headers: getMcpCorsHeaders(req) });
        }
        tenantId = auth.tenant_id;
        userId = auth.user_id;
<<<<<<< HEAD
        authClientId = auth.client_id || authClientId;
=======
>>>>>>> origin/main
      } else {
        tenantId = session.tenant_id;
        userId = session.user_id;
      }
    }
  } else {
    // Stateless fallback using api_key (e.g. for simple HTTP transport clients or initialize method)
    const auth = await validateMCPAuthApp(req);
    if ('error' in auth) {
<<<<<<< HEAD
      return createUnauthorizedResponse(req, 'invalid_token', auth.error);
    }
    tenantId = auth.tenant_id;
    userId = auth.user_id;
    authClientId = auth.client_id || null;
  }

  if (!tenantId || !userId) {
    return createUnauthorizedResponse(
      req,
      'invalid_token',
      'Authentication failed: missing tenant or user context'
    );
=======
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: getMcpCorsHeaders(req) });
    }
    tenantId = auth.tenant_id;
    userId = auth.user_id;
  }

  if (!tenantId || !userId) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Authentication failed: missing tenant or user context' },
      id: requestBody.id ?? null,
    }, { status: 401, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
  }

  // Robust discovery handling for stateless environments
  if (requestBody.method === 'tools/list') {
<<<<<<< HEAD
    const { getUnifiedMcpTools } = await import('@/lib/mcp/listAllTools');
    const tools = await getUnifiedMcpTools({
      clientId: authClientId,
      userAgent: req.headers.get('user-agent'),
    });
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: { tools }
=======
    const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: { tools: MCP_TOOLS }
>>>>>>> origin/main
    }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method === 'resources/list') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
<<<<<<< HEAD
      result: {
        resources: [
          {
            uri: 'mcp://business/snapshot',
            name: 'Business Snapshot',
            description: 'A proactive audit of deals, invoices, leads, and tasks for the current tenant.',
            mimeType: 'application/json',
          },
          {
            uri: 'mcp://business/ai-state',
            name: 'Business AI State',
            description: 'Current AI operating posture, model preference, and audit mode for this workspace.',
            mimeType: 'application/json',
          },
        ],
      },
=======
      result: { resources: [] }
>>>>>>> origin/main
    }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method === 'prompts/list') {
<<<<<<< HEAD
    const { listMcpPrompts } = await import('@/lib/mcp/prompts/review_bonnie_patterns');
    const prompts = listMcpPrompts().map((p) => ({
      name: p.name,
      description: p.description,
      arguments: (p.arguments || []).map((a: any) => ({
        name: a.name,
        description: a.description,
        required: a.required ?? false,
      })),
    }));
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: { prompts },
    }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method === 'prompts/get') {
    const { getMcpPrompt } = await import('@/lib/mcp/prompts/review_bonnie_patterns');
    const name = String(requestBody.params?.name || '');
    const prompt = getMcpPrompt(name);
    if (!prompt) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        error: { code: -32602, message: `Unknown prompt: ${name}` },
      }, { status: 400, headers: getMcpCorsHeaders(req) });
    }
    const args = (requestBody.params?.arguments || {}) as Record<string, string>;
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: {
        description: prompt.description,
        messages: [{ role: 'user', content: { type: 'text', text: prompt.template(args) } }],
      },
=======
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: { prompts: [] }
>>>>>>> origin/main
    }, { headers: getMcpCorsHeaders(req) });
  }

  try {
    const mcpServer = createMCPServer({
      tenantId,
      userId,
      clientLabel: req.headers.get('x-client-label') || 'mcp-messages-app',
    });

    const transport = new StatelessTransport();
    await mcpServer.server.connect(transport);

    if (ENV.NODE_ENV !== 'production') {
      console.log(`[MCP Messages] Passing method: ${requestBody.method} to SDK (Tenant: ${tenantId})`);
    }

    if (transport.onmessage) {
      // Feed the incoming message to the official SDK loop
      transport.onmessage(requestBody);
    }

    // Wait for the SDK to emit a response
    const responseMessage = await transport.getResponse(10000);

    if (!responseMessage) {
      // No response generated (e.g. for notifications)
      return new NextResponse(null, { status: 202, headers: getMcpCorsHeaders(req) });
    }

    const headers = new Headers({
      ...getMcpCorsHeaders(req),
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    });

    // If it was an initialize request, generate a new session ID for subsequent requests
    if (requestBody.method === 'initialize' && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
        global: {
          headers: {
            'Accept': 'application/json',
            'X-Client-Info': 'mcp-session-gen-v2'
          }
        }
      });
<<<<<<< HEAD
      const { getInitialBusinessAIStateForTenant } = await import('@/lib/mcp/getInitialBusinessAIStateForTenant');
      const initialAiState = await getInitialBusinessAIStateForTenant(tenantId);
=======
>>>>>>> origin/main
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(); // 24 hour session
      const { data: sessionRow } = await supabaseAdmin
        .from('mcp_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          expires_at: expiresAt,
          metadata: {
<<<<<<< HEAD
            client_id: authClientId,
            client_label: requestBody.params?.clientInfo?.name || 'mcp-messages-app',
            protocol_version: requestBody.params?.protocolVersion || MCP_PROTOCOL_VERSION,
            initial_ai_state: initialAiState,
            business_ai_version: initialAiState.version,
            business_ai_state: initialAiState,
=======
            client_label: requestBody.params?.clientInfo?.name || 'mcp-messages-app',
            protocol_version: requestBody.params?.protocolVersion || MCP_PROTOCOL_VERSION,
>>>>>>> origin/main
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
    console.error('[MCP Messages POST App] Execution failed:', err);
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal Server Error' },
      id: requestBody?.id ?? null,
    }, { status: 500, headers: getMcpCorsHeaders(req) });
  }

}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
