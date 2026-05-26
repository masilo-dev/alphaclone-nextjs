import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/services/mcp/MCPServer';
import { validateMCPAuthApp, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { StatelessTransport } from '@/services/mcp/StatelessTransport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

const MCP_PROTOCOL_VERSION = '2025-11-20';

/**
 * Unified MCP Endpoint (/api/mcp)
 * 
 * Consolidates all MCP logic into a single file to prevent internal fetch timeouts
 * and self-referencing loops in serverless environments.
 */

async function resolveAuth(req: NextRequest) {
  const auth = await validateMCPAuthApp(req);
  if (!('error' in auth)) {
    return auth;
  }

  // Fallback: Try cookie-based Supabase session
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase-server');
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!userError && user) {
      const tenantIdHeader = req.headers.get('x-tenant-id') || new URL(req.url).searchParams.get('tenantId');
      let resolvedTenantId = tenantIdHeader || '';

      if (!resolvedTenantId) {
        const { data: userTenant } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        resolvedTenantId = userTenant?.tenant_id || '';
      }

      if (resolvedTenantId) {
        return {
          tenant_id: resolvedTenantId,
          user_id: user.id,
        };
      }
    }
  } catch (fallbackErr) {
    console.error('[MCP Route Auth Fallback] failed:', fallbackErr);
  }

  return auth;
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

  // 1. Authentication
  if (mcpSessionId) {
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SERVER_CONFIGURATION_ERROR' }, { status: 500, headers: getMcpCorsHeaders(req) });
    }
    const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mcp_sessions')
      .select('tenant_id, user_id, expires_at')
      .eq('id', mcpSessionId)
      .single();

    if (sessionError || !session) {
      const auth = await resolveAuth(req);
      if ('error' in auth) {
        return NextResponse.json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found. Please re-initialize.' },
          id: requestBody.id ?? null,
        }, { status: 401, headers: getMcpCorsHeaders(req) });
      }
      tenantId = auth.tenant_id;
      userId = auth.user_id;
    } else {
      const expiry = session.expires_at ? new Date(session.expires_at) : new Date(0);
      if (expiry < new Date()) {
        const auth = await resolveAuth(req);
        if ('error' in auth) {
          return NextResponse.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session expired. Please re-initialize.' },
            id: requestBody.id ?? null,
          }, { status: 401, headers: getMcpCorsHeaders(req) });
        }
        tenantId = auth.tenant_id;
        userId = auth.user_id;
      } else {
        tenantId = session.tenant_id;
        userId = session.user_id;
      }
    }
  } else {
    const auth = await resolveAuth(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: getMcpCorsHeaders(req) });
    }
    tenantId = auth.tenant_id;
    userId = auth.user_id;
  }

  // 2. Short-circuit discovery methods (bypass SDK state machine for speed/reliability)
  if (requestBody.method === 'initialize') {
    const response = {
      jsonrpc: '2.0',
      id: requestBody.id,
      result: {
        protocolVersion: '2025-11-20',
        capabilities: {
          prompts: {},
          resources: {
            subscribe: true,
            listChanged: true
          },
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'AlphaClone-Systems-MCP',
          version: '2.0.0'
        }
      }
    };

    const headers = new Headers(getMcpCorsHeaders(req));
    headers.set('MCP-Protocol-Version', '2025-11-20');

    if (ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
        const { data: sessionRow } = await supabaseAdmin
          .from('mcp_sessions')
          .insert({
            tenant_id: tenantId,
            user_id: userId || null,
            expires_at: expiresAt,
            metadata: {
              client_label: requestBody.params?.clientInfo?.name || 'mcp-unified-app',
              protocol_version: '2025-11-20',
            },
          })
          .select('id')
          .single();

        if (sessionRow?.id) {
          headers.set('Mcp-Session-Id', sessionRow.id);
        }
      } catch (sessErr) {
        console.error('Failed to create session on initialize:', sessErr);
      }
    }

    return NextResponse.json(response, { headers });
  }

  if (requestBody.method === 'tools/list') {
    const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
    const { initializeRegistry, listTools } = await import('@/lib/mcp/tool-registry');
    initializeRegistry();
    const newTools = listTools();
    const newToolNames = new Set(newTools.map(t => t.name));
    const legacyFiltered = MCP_TOOLS.filter(t => !newToolNames.has(t.name));
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: { tools: [...newTools, ...legacyFiltered] }
    }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method === 'resources/list') {
    return NextResponse.json({ 
      jsonrpc: '2.0', 
      id: requestBody.id, 
      result: { 
        resources: [
          {
            uri: 'mcp://business/snapshot',
            name: 'Business Snapshot',
            description: 'A proactive audit of deals, invoices, leads, and tasks for the current tenant.',
            mimeType: 'application/json'
          }
        ] 
      } 
    }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method === 'prompts/list') {
    const { listMcpPrompts } = await import('@/lib/mcp/prompts/review_bonnie_patterns');
    const prompts = listMcpPrompts().map(p => ({
      name: p.name,
      description: p.description,
      arguments: (p.arguments || []).map((a: any) => ({
        name: a.name,
        description: a.description,
        required: a.required ?? false,
      })),
    }));
    return NextResponse.json({ jsonrpc: '2.0', id: requestBody.id, result: { prompts } }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method?.startsWith('notifications/')) {
    return new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
  }

  // 3. Execute via SDK
  try {
    const mcpServer = createMCPServer({
      tenantId,
      userId,
      clientLabel: req.headers.get('x-client-label') || 'mcp-unified-app',
    });

    const transport = new StatelessTransport();
    await mcpServer.server.connect(transport);

    if (transport.onmessage) {
      transport.onmessage(requestBody);
    }

    const responseMessage = await transport.getResponse(10000);

    if (!responseMessage) {
      return new NextResponse(null, { status: 202, headers: getMcpCorsHeaders(req) });
    }

    const headers = new Headers(getMcpCorsHeaders(req));
    headers.set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);

    // Generate session on initialize
    if (requestBody.method === 'initialize' && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      const { data: sessionRow } = await supabaseAdmin
        .from('mcp_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          expires_at: expiresAt,
          metadata: {
            client_label: requestBody.params?.clientInfo?.name || 'mcp-unified-app',
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
    console.error('[MCP Unified POST] Execution failed:', err);
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal Server Error' },
      id: requestBody?.id ?? null,
    }, { status: 500, headers: getMcpCorsHeaders(req) });
  }
}

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const auth = await resolveAuth(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: getMcpCorsHeaders(req) });
  }

  const { MCP_TOOLS } = await import('@/services/mcp/toolManifest');
  const { initializeRegistry, listTools } = await import('@/lib/mcp/tool-registry');
  initializeRegistry();
  const newTools = listTools();
  const newToolNames = new Set(newTools.map(t => t.name));
  const legacyFiltered = MCP_TOOLS.filter(t => !newToolNames.has(t.name));

  return NextResponse.json({ tools: [...newTools, ...legacyFiltered] }, { 
    headers: { 
      ...getMcpCorsHeaders(req), 
      'X-MCP-Version': '2.0.0',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION
    } 
  });
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
}
