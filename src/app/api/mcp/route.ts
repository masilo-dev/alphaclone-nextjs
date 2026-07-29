import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import {
  validateMCPAuthApp,
  handleCorsApp,
  getMcpCorsHeaders,
  createUnauthorizedResponse,
} from '@/services/mcp/authMiddlewareApp';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { negotiateClientCapabilities } from '@/lib/mcp/clientCapabilities';
=======
import { createMCPServer } from '@/services/mcp/MCPServer';
import { validateMCPAuthApp, handleCorsApp, getMcpCorsHeaders } from '@/services/mcp/authMiddlewareApp';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { StatelessTransport } from '@/services/mcp/StatelessTransport';
>>>>>>> origin/main

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800;

<<<<<<< HEAD
const MCP_PROTOCOL_VERSION = '2025-11-25';
const MCP_VERSION_HEADER = '2025-03-26';
const SUPPORTED_MCP_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-11-25'] as const;

function mcpJsonHeaders(req: NextRequest, extra?: Record<string, string>): HeadersInit {
  return {
    ...getMcpCorsHeaders(req),
    'Content-Type': 'application/json',
    'MCP-Version': MCP_VERSION_HEADER,
    ...extra,
  };
}

function toUtcIso(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toUtcIso);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (entry instanceof Date) {
        normalized[key] = entry.toISOString();
      } else if (
        typeof entry === 'string'
        && /(?:_at|_date|At|Date|timestamp|expires|expiry|due)$/i.test(key)
        && !Number.isNaN(Date.parse(entry))
      ) {
        normalized[key] = new Date(entry).toISOString();
      } else if (entry && typeof entry === 'object') {
        normalized[key] = toUtcIso(entry);
      } else {
        normalized[key] = entry;
      }
    }
    return normalized;
  }
  return value;
}

function negotiateProtocolVersion(requested: unknown): string {
  if (typeof requested === 'string' && (SUPPORTED_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return MCP_PROTOCOL_VERSION;
}
=======
const MCP_PROTOCOL_VERSION = '2025-03-26';
>>>>>>> origin/main

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
<<<<<<< HEAD
      // Hint is NEVER authoritative — must verify membership first.
      const hinted =
        req.headers.get('x-tenant-id') || new URL(req.url).searchParams.get('tenantId') || '';

      try {
        const { resolveActiveTenantForUser } = await import('@/lib/tenant/platformTenant');
        const resolved = await resolveActiveTenantForUser({
          userId: user.id,
          hintedTenantId: hinted || null,
        });
        return {
          tenant_id: resolved.tenantId,
          user_id: user.id,
          client_id: undefined as string | undefined,
        };
      } catch (membershipErr) {
        console.warn('[MCP Route Auth Fallback] tenant membership rejected:', membershipErr);
        // Fall through to unauthorized
=======
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
>>>>>>> origin/main
      }
    }
  } catch (fallbackErr) {
    console.error('[MCP Route Auth Fallback] failed:', fallbackErr);
  }

  return auth;
}

<<<<<<< HEAD
function authClientIdOf(auth: { client_id?: string } | { error: string }): string | null {
  if ('error' in auth) return null;
  return auth.client_id || null;
}

function unauthorizedFromAuth(req: NextRequest, auth: { error: string; status: number; wwwAuthenticate?: string }) {
  if (auth.status === 403) {
    return createUnauthorizedResponse(req, 'insufficient_scope', auth.error, undefined, 403);
  }
  if (auth.status === 401) {
    return createUnauthorizedResponse(req, 'invalid_token', auth.error, undefined, 401);
  }
  return NextResponse.json(
    { error: auth.error },
    {
      status: auth.status,
      headers: {
        ...mcpJsonHeaders(req),
        ...(auth.wwwAuthenticate ? { 'WWW-Authenticate': auth.wwwAuthenticate } : {}),
      },
    }
  );
}

=======
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
<<<<<<< HEAD
    }, { status: 400, headers: mcpJsonHeaders(req) });
=======
    }, { status: 400, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
  }

  if (!requestBody || typeof requestBody !== 'object' || !requestBody.method) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: requestBody?.id ?? null,
<<<<<<< HEAD
    }, { status: 400, headers: mcpJsonHeaders(req) });
=======
    }, { status: 400, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
  }

  const mcpSessionId = req.headers.get('mcp-session-id');
  let tenantId = '';
  let userId = '';

  // 1. Authentication
  if (mcpSessionId) {
    if (!ENV.VITE_SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
<<<<<<< HEAD
      return NextResponse.json({ error: 'SERVER_CONFIGURATION_ERROR' }, { status: 500, headers: mcpJsonHeaders(req) });
=======
      return NextResponse.json({ error: 'SERVER_CONFIGURATION_ERROR' }, { status: 500, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
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
<<<<<<< HEAD
        return unauthorizedFromAuth(req, auth);
=======
        return NextResponse.json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found. Please re-initialize.' },
          id: requestBody.id ?? null,
        }, { status: 401, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
      }
      tenantId = auth.tenant_id;
      userId = auth.user_id;
    } else {
      const expiry = session.expires_at ? new Date(session.expires_at) : new Date(0);
      if (expiry < new Date()) {
        const auth = await resolveAuth(req);
        if ('error' in auth) {
<<<<<<< HEAD
          return unauthorizedFromAuth(req, auth);
=======
          return NextResponse.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Session expired. Please re-initialize.' },
            id: requestBody.id ?? null,
          }, { status: 401, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
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
<<<<<<< HEAD
      return unauthorizedFromAuth(req, auth);
=======
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
    }
    tenantId = auth.tenant_id;
    userId = auth.user_id;
  }

<<<<<<< HEAD
  // Re-validate active membership for every request (sessions/tokens alone are not enough)
  try {
    const { assertTenantMembership } = await import('@/lib/tenant/platformTenant');
    await assertTenantMembership(tenantId, userId);
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Workspace membership is not active' },
      { status: 401, headers: mcpJsonHeaders(req) }
    );
  }

  // 2. Short-circuit handshake methods (SDK import crashes in serverless for initialize)
  if (requestBody.method === 'initialize') {
    const protocolVersion = negotiateProtocolVersion(requestBody.params?.protocolVersion);
    const clientName = String(requestBody.params?.clientInfo?.name || 'generic-mcp');
    const clientCapabilities = negotiateClientCapabilities({
      protocolVersion,
      clientName,
      userAgent: req.headers.get('user-agent'),
      advertised: requestBody.params?.capabilities,
    });
    const headers = new Headers(mcpJsonHeaders(req) as Record<string, string>);
    headers.set('MCP-Protocol-Version', protocolVersion);

    if (ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
      const { getInitialBusinessAIStateForTenant } = await import('@/lib/mcp/getInitialBusinessAIStateForTenant');
      const initialAiState = await getInitialBusinessAIStateForTenant(tenantId);
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      let initClientId: string | null = null;
      try {
        const auth = await resolveAuth(req);
        initClientId = authClientIdOf(auth);
      } catch {
        // ignore
      }
      const { data: sessionRow, error: sessionError } = await supabaseAdmin
        .from('mcp_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          expires_at: expiresAt,
          client_name: clientName,
          client_instance_id: String(requestBody.params?.clientInfo?.version || crypto.randomUUID()),
          protocol_version: protocolVersion,
          transport: 'streamable-http',
          capabilities: clientCapabilities,
          connected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          status: 'connected',
          metadata: {
            client_label: requestBody.params?.clientInfo?.name || 'mcp-unified-app',
            client_id: initClientId,
            protocol_version: protocolVersion,
            business_ai_version: initialAiState.version,
            business_ai_state: initialAiState,
          },
        })
        .select('id')
        .single();

      if (sessionError) {
        console.error('[MCP initialize] Session creation failed:', sessionError);
      } else if (sessionRow?.id) {
        headers.set('Mcp-Session-Id', sessionRow.id);
      }
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: {
        protocolVersion,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: 'AlphaClone-MCP', version: '2.0.0' },
      },
    }, { headers });
  }

  if (requestBody.method === 'ping') {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: {},
    }, { headers: mcpJsonHeaders(req) });
  }

  // 3. Short-circuit discovery methods (bypass SDK state machine for speed/reliability)
  if (requestBody.method === 'tools/list') {
    try {
      const { getUnifiedMcpTools } = await import('@/lib/mcp/listAllTools');

      // Prefer live auth client_id; fall back to session metadata / UA for ChatGPT detection.
      let clientId: string | null = null;
      let clientLabel: string | null = null;
      try {
        const auth = await resolveAuth(req);
        clientId = authClientIdOf(auth);
      } catch {
        // ignore — cookie/session path may still work below
      }
      if (mcpSessionId && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
          const { data: sessionMeta } = await supabaseAdmin
            .from('mcp_sessions')
            .select('metadata')
            .eq('id', mcpSessionId)
            .maybeSingle();
          const meta = (sessionMeta?.metadata || {}) as Record<string, unknown>;
          if (typeof meta.client_label === 'string') clientLabel = meta.client_label;
          if (typeof meta.client_id === 'string' && !clientId) clientId = meta.client_id;
        } catch {
          // ignore
        }
      }

      const tools = await getUnifiedMcpTools({
        clientId,
        clientLabel,
        userAgent: req.headers.get('user-agent'),
      });

      console.info(
        `[mcp.route tools/list] count=${tools.length} clientId=${clientId || '-'} label=${clientLabel || '-'} ua=${(req.headers.get('user-agent') || '').slice(0, 80)}`
      );

      if (tools.length === 0) {
        console.error('[mcp.route tools/list] CRITICAL: returning empty tool list');
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { tools },
      }, { headers: mcpJsonHeaders(req) });
    } catch (err: any) {
      console.error('[mcp.route tools/list] error:', err?.message || err);
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        error: {
          code: -32603,
          message: `tools/list failed: ${err?.message || 'unknown error'}`,
        },
      }, { status: 500, headers: mcpJsonHeaders(req) });
    }
=======
  // 2. Short-circuit discovery methods (bypass SDK state machine for speed/reliability)
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
>>>>>>> origin/main
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
<<<<<<< HEAD
          },
          {
            uri: 'mcp://business/ai-state',
            name: 'Business AI State',
            description: 'Current AI operating posture, model preference, and audit mode for this workspace.',
            mimeType: 'application/json'
          }
        ] 
      } 
    }, { headers: mcpJsonHeaders(req) });
=======
          }
        ] 
      } 
    }, { headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
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
<<<<<<< HEAD
    return NextResponse.json({ jsonrpc: '2.0', id: requestBody.id, result: { prompts } }, { headers: mcpJsonHeaders(req) });
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
      }, { status: 400, headers: mcpJsonHeaders(req) });
    }
    const args = (requestBody.params?.arguments || {}) as Record<string, string>;
    const text = prompt.template(args);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: requestBody.id,
      result: {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: { type: 'text', text },
          },
        ],
      },
    }, { headers: mcpJsonHeaders(req) });
  }

  if (requestBody.method?.startsWith('notifications/')) {
    return new NextResponse(null, { status: 204, headers: { ...getMcpCorsHeaders(req), 'MCP-Version': MCP_VERSION_HEADER } });
  }

  // 4. Handle ticketing tools directly (bypass SDK for reliability)
  if (requestBody.method === 'tools/call') {
    const toolName = requestBody.params?.name;
    const toolArgs = requestBody.params?.arguments || {};

    if (['list_tools', 'list_modules', 'list_capabilities', 'search_tools', 'load_module_tools'].includes(toolName)) {
      const { getUnifiedMcpTools } = await import('@/lib/mcp/listAllTools');
      const { MODULE_KEYWORDS, coreTools, searchToolCatalog } = await import('@/lib/mcp/progressiveDiscovery');
      const full = await getUnifiedMcpTools({ forChatGPT: false });
      let data: unknown;
      if (toolName === 'list_modules') data = Object.keys(MODULE_KEYWORDS);
      else if (toolName === 'list_tools') data = coreTools(full);
      else if (toolName === 'list_capabilities') data = {
        progressive_discovery: true,
        durable_jobs: true,
        oauth_grants: true,
        media_transfer: ['base64', 'source_url', 'signed_upload'],
      };
      else data = searchToolCatalog(full, {
        query: toolArgs.query,
        module: toolName === 'load_module_tools' ? toolArgs.module : toolArgs.module,
        action: toolArgs.action,
        limit: toolArgs.limit,
      });
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: { data } },
      }, { headers: mcpJsonHeaders(req) });
    }

    // Enforce OAuth scopes before any tool side effects
    try {
      const auth = await resolveAuth(req);
      if (!('error' in auth)) {
        const { requiredScopesForTool, hasRequiredScopes } = await import('@/lib/mcp/scopes');
        const scopes = (auth as { scope?: string[] }).scope || ['read', 'write'];
        const required = requiredScopesForTool(String(toolName || ''));
        const check = hasRequiredScopes(scopes, required);
        if (!check.valid) {
          return createUnauthorizedResponse(
            req,
            'insufficient_scope',
            `Missing scopes: ${check.missing.join(', ')}`,
            check.missing,
            403
          );
        }
      }
    } catch {
      // resolveAuth already enforced above for session path; continue
    }

    if (toolName === 'create_ticket') {
      const admin = createAdminSupabaseClientOrThrow();
      const { data: ticket, error } = await admin
        .from('tickets')
        .insert({
          tenant_id: tenantId,
          title: toolArgs.title,
          description: toolArgs.description || '',
          priority: toolArgs.priority || 'medium',
          source: toolArgs.source || 'bonnie_agent',
          channel: toolArgs.source || 'bonnie_agent',
          ticket_type: ['billing', 'technical'].includes(toolArgs.category)
            ? toolArgs.category
            : toolArgs.category === 'bug'
              ? 'incident'
              : toolArgs.category === 'feature_request'
                ? 'request'
                : 'question',
          contact_id: toolArgs.contact_id || null,
          client_id: toolArgs.client_id || null,
          created_by: userId,
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: requestBody.id,
          error: { code: -32603, message: `Failed to create ticket: ${error.message}` },
        }, { status: 500, headers: mcpJsonHeaders(req) });
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: JSON.stringify(toUtcIso(ticket)) }] },
      }, { headers: mcpJsonHeaders(req) });
    }

    if (toolName === 'get_tickets') {
      const admin = createAdminSupabaseClientOrThrow();
      let query = admin
        .from('tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(toolArgs.limit || 20);

      if (toolArgs.status) query = query.eq('status', toolArgs.status);
      if (toolArgs.priority) query = query.eq('priority', toolArgs.priority);
      if (toolArgs.category) {
        const requestedType = ['billing', 'technical'].includes(toolArgs.category)
          ? toolArgs.category
          : toolArgs.category === 'bug'
            ? 'incident'
            : toolArgs.category === 'feature_request'
              ? 'request'
              : 'question';
        query = query.eq('ticket_type', requestedType);
      }

      const { data: tickets, error } = await query;

      if (error) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: requestBody.id,
          error: { code: -32603, message: `Failed to fetch tickets: ${error.message}` },
        }, { status: 500, headers: mcpJsonHeaders(req) });
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: JSON.stringify(toUtcIso(tickets || [])) }] },
      }, { headers: mcpJsonHeaders(req) });
    }

    if (toolName === 'update_ticket') {
      const admin = createAdminSupabaseClientOrThrow();
      const updateData: any = {};
      if (toolArgs.status) updateData.status = toolArgs.status;
      if (toolArgs.priority) updateData.priority = toolArgs.priority;
      if (toolArgs.assigned_to) updateData.assigned_to = toolArgs.assigned_to;
      
      // Auto-set resolved_at if status changes to resolved
      if (toolArgs.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
      // Auto-set closed_at if status changes to closed
      if (toolArgs.status === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      updateData.updated_at = new Date().toISOString();

      const { data: ticket, error } = await admin
        .from('tickets')
        .update(updateData)
        .eq('id', toolArgs.ticket_id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: requestBody.id,
          error: { code: -32603, message: `Failed to update ticket: ${error.message}` },
        }, { status: 500, headers: mcpJsonHeaders(req) });
      }

      if (toolArgs.resolution_note) {
        const { error: noteError } = await admin.from('ticket_messages').insert({
          tenant_id: tenantId,
          ticket_id: ticket.id,
          author_user_id: userId,
          message_type: 'internal_note',
          body_text: String(toolArgs.resolution_note),
          visibility: 'internal',
          metadata: { source: 'mcp_update_ticket', resolution_note: true },
        });
        if (noteError) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: requestBody.id,
            error: { code: -32603, message: 'Ticket updated but its resolution note could not be recorded' },
          }, { status: 500, headers: mcpJsonHeaders(req) });
        }
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: JSON.stringify(toUtcIso(ticket)) }] },
      }, { headers: mcpJsonHeaders(req) });
    }

    if (toolName === 'get_ticket_stats') {
      const admin = createAdminSupabaseClientOrThrow();
      
      // Get counts by status
      const { data: allTickets } = await admin
        .from('tickets')
        .select('status')
        .eq('tenant_id', tenantId);

      const statusCountsMap: Record<string, number> = {};
      (allTickets || []).forEach((t: any) => {
        statusCountsMap[t.status] = (statusCountsMap[t.status] || 0) + 1;
      });
      const statusCounts = Object.entries(statusCountsMap).map(([status, count]) => ({ status, count }));

      // Get average resolution time
      const { data: avgResolution } = await admin
        .rpc('get_avg_ticket_resolution_time', { p_tenant_id: tenantId })
        .maybeSingle();

      // Get SLA breaches
      const { data: slaBreaches } = await admin
        .from('tickets')
        .select('id, title, sla_due_at, created_at')
        .eq('tenant_id', tenantId)
        .in('status', ['new', 'open', 'in_progress', 'waiting_on_business', 'escalated', 'reopened'])
        .lt('sla_due_at', new Date().toISOString())
        .limit(10);

      const stats = toUtcIso({
        status_counts: statusCounts || [],
        avg_resolution_hours: (avgResolution as { avg_hours?: number } | null)?.avg_hours || null,
        sla_breaches: slaBreaches || [],
        total_open: (statusCounts || []).filter((s: any) => s.status === 'open').reduce((sum: number, s: any) => sum + (s.count || 0), 0),
      });

      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: JSON.stringify(stats) }] },
      }, { headers: mcpJsonHeaders(req) });
    }

    if (toolName === 'escalate_ticket') {
      const admin = createAdminSupabaseClientOrThrow();
      
      const { data: ticket, error } = await admin
        .from('tickets')
        .update({
          priority: 'urgent',
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', toolArgs.ticket_id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: requestBody.id,
          error: { code: -32603, message: `Failed to escalate ticket: ${error.message}` },
        }, { status: 500, headers: mcpJsonHeaders(req) });
      }

      // Send notification to Alpha
      await admin
        .from('notifications')
        .insert({
          tenant_id: tenantId,
          title: `🚨 Ticket Escalated: ${ticket.title}`,
          body: `Reason: ${toolArgs.reason}\n\nTicket #${ticket.ticket_number || ticket.id}`,
          type: 'ticket_escalation',
          metadata: {
            ticket_id: toolArgs.ticket_id,
            reason: toolArgs.reason,
          },
          created_at: new Date().toISOString(),
        });

      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: { content: [{ type: 'text', text: JSON.stringify(toUtcIso(ticket)) }] },
      }, { headers: mcpJsonHeaders(req) });
    }

    // Registry tools — bypass MCPServer (avoids nodemailer / heavy email import chain)
    const { initializeRegistry, hasTool, executeTool } = await import('@/lib/mcp/tool-registry');
    initializeRegistry();
    if (hasTool(toolName)) {
      const result = await executeTool(tenantId, userId, toolName, {
        ...toolArgs,
        tenant_id: tenantId,
        user_id: userId,
      });
      return NextResponse.json({
        jsonrpc: '2.0',
        id: requestBody.id,
        result: toUtcIso(result),
      }, { headers: mcpJsonHeaders(req) });
    }
  }

  // 5. Execute via SDK (lazy-load heavy MCPServer module for POST only)
  try {
    const { createMCPServer } = await import('@/services/mcp/MCPServer');
    const { StatelessTransport } = await import('@/services/mcp/StatelessTransport');

=======
    return NextResponse.json({ jsonrpc: '2.0', id: requestBody.id, result: { prompts } }, { headers: getMcpCorsHeaders(req) });
  }

  if (requestBody.method?.startsWith('notifications/')) {
    return new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
  }

  // 3. Execute via SDK
  try {
>>>>>>> origin/main
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
<<<<<<< HEAD
      return new NextResponse(null, { status: 202, headers: { ...getMcpCorsHeaders(req), 'MCP-Version': MCP_VERSION_HEADER } });
    }

    const headers = new Headers(mcpJsonHeaders(req) as Record<string, string>);
=======
      return new NextResponse(null, { status: 202, headers: getMcpCorsHeaders(req) });
    }

    const headers = new Headers(getMcpCorsHeaders(req));
>>>>>>> origin/main
    headers.set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);

    // Generate session on initialize
    if (requestBody.method === 'initialize' && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
<<<<<<< HEAD
      const { getInitialBusinessAIStateForTenant } = await import('@/lib/mcp/getInitialBusinessAIStateForTenant');
      const initialAiState = await getInitialBusinessAIStateForTenant(tenantId);
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
            business_ai_version: initialAiState.version,
            business_ai_state: initialAiState,
=======
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
    console.error('[MCP Unified POST] Execution failed:', err);
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal Server Error' },
      id: requestBody?.id ?? null,
<<<<<<< HEAD
    }, { status: 500, headers: mcpJsonHeaders(req) });
=======
    }, { status: 500, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
  }
}

export async function GET(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

<<<<<<< HEAD
  try {
    const auth = await resolveAuth(req);
    if ('error' in auth) {
      return unauthorizedFromAuth(req, auth);
    }

    const { getUnifiedMcpTools } = await import('@/lib/mcp/listAllTools');
    const tools = await getUnifiedMcpTools({
      clientId: authClientIdOf(auth),
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({ tools, count: tools.length }, {
      headers: mcpJsonHeaders(req, {
        'X-MCP-Version': '2.0.0',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      }),
    });
  } catch (err) {
    console.error('[MCP GET] Failed:', err);
    return NextResponse.json(
      { error: 'MCP server failed to load tools' },
      { status: 500, headers: mcpJsonHeaders(req) }
    );
  }
}

/**
 * DELETE handler for session termination (HTTP Transport)
 * 
 * Per MCP 2025-11-25 spec: DELETE should terminate the session and clean up resources.
 * This provides parity with the SSE transport's DELETE endpoint.
 */
export async function DELETE(req: NextRequest) {
  const cors = handleCorsApp(req);
  if (cors) return cors;

  const auth = await resolveAuth(req);
  if ('error' in auth) {
    return unauthorizedFromAuth(req, auth);
  }

  const mcpSessionId = req.headers.get('mcp-session-id');
  
  if (mcpSessionId && ENV.VITE_SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseAdmin = createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
      await supabaseAdmin
        .from('mcp_sessions')
        .delete()
        .eq('id', mcpSessionId)
        .eq('tenant_id', auth.tenant_id)
        .eq('user_id', auth.user_id);
      console.log('[MCP HTTP DELETE] Session terminated:', mcpSessionId);
    } catch (err) {
      console.warn('[MCP HTTP DELETE] Session cleanup failed:', err);
      // Continue to return 204 even if cleanup fails - client should consider session closed
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getMcpCorsHeaders(req),
      'MCP-Version': MCP_VERSION_HEADER,
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    },
=======
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
>>>>>>> origin/main
  });
}

export async function OPTIONS(req: NextRequest) {
<<<<<<< HEAD
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: { ...getMcpCorsHeaders(req), 'MCP-Version': MCP_VERSION_HEADER } });
=======
  return handleCorsApp(req) || new NextResponse(null, { status: 204, headers: getMcpCorsHeaders(req) });
>>>>>>> origin/main
}
