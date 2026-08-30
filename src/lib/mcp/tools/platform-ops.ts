import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUnifiedMcpToolCount } from '@/lib/mcp/listAllTools';
import { buildApiHealthReport } from '@/lib/mcp/apiHealthReport';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult } from '@/lib/mcp/connector/response';
import { throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_platform_status',
  description:
    'Return live Alphaclone platform status: database, MCP catalog, health score, API error pressure, and module readiness. Status is operational, degraded, or unhealthy — never a static placeholder.',
  permission: 'platform:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid', description: 'Tenant UUID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const toolCount = await getUnifiedMcpToolCount();
    const { MCP_TOOL_CATALOG_VERSION } = await import('@/lib/mcp/standardResponse');
    const { SOCIAL_PUBLISH_TOOL_CATALOG_VERSION } = await import('@/lib/social/types');

    const [{ error: dbError }, { count: leadCount }] = await Promise.all([
      supabase.from('tenants').select('id').eq('id', args.tenant_id).maybeSingle(),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
    ]);

    let audit: Awaited<ReturnType<typeof import('@/lib/mcp/audit/platformAuditEngine').runPlatformAudit>> | null =
      null;
    try {
      const { runPlatformAudit } = await import('@/lib/mcp/audit/platformAuditEngine');
      audit = await runPlatformAudit({
        tenantId: args.tenant_id,
        includeSlowQueries: false,
      });
    } catch {
      audit = null;
    }

    let apiHealth: Record<string, unknown> | null = null;
    try {
      apiHealth = (await buildApiHealthReport(args.tenant_id, 24)) as Record<string, unknown>;
    } catch (err: unknown) {
      apiHealth = { error: err instanceof Error ? err.message : String(err) };
    }

    const errorRate = Number(
      apiHealth?.error_rate ?? (apiHealth?.summary as Record<string, unknown> | undefined)?.error_rate ?? 0
    );
    const dbHealthy = !dbError;
    const catalogHealthy = toolCount >= 500;
    const auditScore = audit?.score ?? null;
    const criticalFindings = (audit?.findings || []).filter((f) => f.severity === 'critical').length;

    let status: 'operational' | 'degraded' | 'unhealthy' = 'operational';
    if (!dbHealthy || toolCount < 50 || criticalFindings > 0) {
      status = 'unhealthy';
    } else if ((auditScore !== null && auditScore < 75) || errorRate > 0.15 || !catalogHealthy) {
      status = 'degraded';
    }

    return okResult('get_platform_status', {
      status,
      product: 'Alphaclone Systems',
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        mcp_catalog: catalogHealthy ? 'healthy' : 'degraded',
        api_error_rate_24h: errorRate,
        platform_audit_score: auditScore,
        platform_audit_grade: audit?.grade ?? null,
      },
      health: audit
        ? {
            score: audit.score,
            grade: audit.grade,
            summary: audit.summary,
            critical_findings: criticalFindings,
            modules: audit.modules,
          }
        : null,
      mcp: {
        protocol_version: '2025-11-25',
        discovered_tools: toolCount,
        tool_catalog_version: MCP_TOOL_CATALOG_VERSION,
        social_publish_catalog_version: SOCIAL_PUBLISH_TOOL_CATALOG_VERSION,
        transport: 'streamable-http',
        endpoint: '/api/mcp',
      },
      tool_catalog_version: MCP_TOOL_CATALOG_VERSION,
      tenant: {
        id: args.tenant_id,
        lead_count: leadCount ?? 0,
      },
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_system_health',
  description:
    'Deep system health check: database, memory, Redis, MCP telemetry, and recent error pressure.',
  permission: 'platform:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    hours: z.number().int().min(1).max(168).optional().default(24),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      hours: { type: 'number', description: 'Lookback hours for telemetry (default 24)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const start = Date.now();
    const { error: dbError } = await supabase.from('tenants').select('id').eq('id', args.tenant_id).maybeSingle();
    let redisOk = false;
    try {
      const { redis, redisEnabled } = await import('@/lib/cache/redis');
      if (redisEnabled && redis) {
        await redis.ping();
        redisOk = true;
      }
    } catch {
      redisOk = false;
    }

    let apiHealth: unknown = null;
    try {
      apiHealth = await buildApiHealthReport(args.tenant_id, args.hours);
    } catch (err: any) {
      apiHealth = { error: err?.message || String(err) };
    }

    const mem = process.memoryUsage();
    const healthy = !dbError;
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks: {
        database: { status: dbError ? 'unhealthy' : 'healthy', error: dbError?.message },
        redis: { status: redisOk ? 'healthy' : 'unavailable' },
        runtime: {
          status: 'healthy',
          uptime_seconds: Math.round(process.uptime()),
          memory_mb: {
            heap_used: Math.round(mem.heapUsed / 1024 / 1024),
            heap_total: Math.round(mem.heapTotal / 1024 / 1024),
            rss: Math.round(mem.rss / 1024 / 1024),
          },
          node: process.version,
        },
        api_health: apiHealth,
      },
      response_time_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_version',
  description: 'Return Alphaclone application, MCP protocol, and Node runtime versions.',
  permission: 'platform:read',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
  },
  handler: async () => ({
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    package_name: 'alphaclone-nextjs',
    mcp_protocol_version: '2025-11-25',
    status: 'operational',
    environment: process.env.NODE_ENV || 'production',
  }),
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_environment',
  description:
    'Return tenant-owned environment metadata and active workspace integrations for this tenant.',
  permission: 'platform:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const [
      { count: emailSendersCount },
      { count: linkedinCount },
      { count: facebookCount },
      { data: tenant },
    ] = await Promise.all([
      supabase.from('email_sender_identities').select('id', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('linkedin_integrations').select('id', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('facebook_integrations').select('id', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('tenants').select('id, name, plan, features').eq('id', args.tenant_id).maybeSingle(),
    ]);

    return {
      tenant_id: args.tenant_id,
      tenant_name: (tenant as any)?.name || 'Workspace',
      plan: (tenant as any)?.plan || 'enterprise',
      tenant_integrations: {
        email_senders_configured: (emailSendersCount || 0) > 0,
        linkedin_connected: (linkedinCount || 0) > 0,
        facebook_connected: (facebookCount || 0) > 0,
      },
      capabilities: {
        lead_discovery: true,
        unified_inbox: true,
        social_publisher: true,
        bonnie_agentic_os: true,
        mcp_catalog_version: '2025-11-25',
      },
    };
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_feature_flags',
  description:
    'Return tenant and platform feature flags that gate Alphaclone modules for this workspace.',
  permission: 'platform:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const flags: Record<string, unknown> = {
      mcp_enabled: true,
      chatgpt_connector: true,
      bonnie_agentic_os: true,
      social_publish: process.env.SOCIAL_PUBLISH_ENABLED !== 'false',
    };

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, plan, settings, features, metadata')
      .eq('id', args.tenant_id)
      .maybeSingle();

    if (tenant) {
      flags.plan = (tenant as any).plan || null;
      const settings = (tenant as any).settings;
      const features = (tenant as any).features;
      const metadata = (tenant as any).metadata;
      if (settings && typeof settings === 'object') flags.tenant_settings = settings;
      if (features && typeof features === 'object') flags.tenant_features = features;
      if (metadata && typeof metadata === 'object' && (metadata as any).feature_flags) {
        flags.metadata_feature_flags = (metadata as any).feature_flags;
      }
    }

    const { data: flagRows } = await supabase
      .from('feature_flags')
      .select('key, enabled, value, tenant_id')
      .or(`tenant_id.eq.${args.tenant_id},tenant_id.is.null`)
      .limit(200);

    if (flagRows && flagRows.length > 0) {
      flags.database_flags = Object.fromEntries(
        flagRows.map((row: any) => [row.key, { enabled: row.enabled, value: row.value }])
      );
    }

    return flags;
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_recent_errors',
  description:
    'List recent MCP tool failures and platform errors for the tenant with pagination.',
  permission: 'platform:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
    hours: z.number().int().min(1).max(168).optional().default(24),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      hours: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    const since = new Date(Date.now() - args.hours * 3600 * 1000).toISOString();

    const { data, error, count } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, error_message, duration_ms, created_at, metadata', {
        count: 'exact',
      })
      .eq('tenant_id', args.tenant_id)
      .eq('success', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throwConnectorError('QUERY_FAILED', error.message);

    return okResult('get_recent_errors', { errors: data || [], since }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
    });
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'get_audit_logs',
  description:
    'Retrieve Alphaclone audit trail entries with filters and pagination for compliance review.',
  permission: 'audit:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
    action: z.string().optional(),
    entity_type: z.string().optional(),
    user_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      action: { type: 'string' },
      entity_type: { type: 'string' },
      user_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (args.action) query = query.eq('action', args.action);
    if (args.entity_type) query = query.eq('entity_type', args.entity_type);
    if (args.user_id) query = query.eq('user_id', args.user_id);

    const { data, error, count } = await query;
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    return okResult('get_audit_logs', { logs: data || [] }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
    });
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'restart_service',
  description:
    'Protected admin action: request a controlled restart/reload signal for an Alphaclone service worker. Owner-only. Does not hard-kill the Railway process; records an audited restart request for orchestrators.',
  permission: 'platform:restart',
  rateLimitClass: 'restart',
  auditAction: 'mcp_restart_service',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    service: z.enum(['mcp', 'bonnie-worker', 'cron-dispatcher', 'social-publisher']),
    reason: z.string().min(3).max(500),
    confirm: z.literal(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      service: {
        type: 'string',
        enum: ['mcp', 'bonnie-worker', 'cron-dispatcher', 'social-publisher'],
      },
      reason: { type: 'string' },
      confirm: { type: 'boolean', description: 'Must be true to proceed' },
    },
    required: ['tenant_id', 'service', 'reason', 'confirm'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const requestId = crypto.randomUUID();
    const payload = {
      id: requestId,
      tenant_id: args.tenant_id,
      requested_by: ctx.userId,
      service: args.service,
      reason: args.reason,
      status: 'queued',
      created_at: new Date().toISOString(),
    };

    // Persist restart request for ops/cron consumers (table may be generic jobs queue)
    const { error } = await supabase.from('background_jobs').insert({
      tenant_id: args.tenant_id,
      job_type: 'service_restart',
      payload,
      status: 'queued',
      created_by: ctx.userId,
      created_at: new Date().toISOString(),
    });

    if (error && error.code !== '42P01') {
      // Fall back to audit_logs-only trail when background_jobs is unavailable
      await supabase.from('audit_logs').insert({
        tenant_id: args.tenant_id,
        user_id: ctx.userId,
        action: 'service_restart_requested',
        entity_type: 'service',
        entity_id: args.service,
        new_value: payload,
        created_at: new Date().toISOString(),
      });
    }

    return {
      request_id: requestId,
      service: args.service,
      status: 'queued',
      message:
        'Restart request recorded. Platform orchestrators will process it; the MCP HTTP process itself is not force-killed.',
    };
  },
});

defineConnectorTool({
  module: 'platform-ops',
  name: 'audit_platform',
  description:
    'Run the full Alphaclone platform audit engine: detect failures, missing integrations, broken APIs, slow queries, security risks, deployment issues, failed workflows, AI hallucination risks, and permission problems. Returns a health score and actionable recommendations.',
  permission: 'audit:run',
  rateLimitClass: 'audit',
  auditAction: 'mcp_audit_platform',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    include_slow_queries: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      include_slow_queries: { type: 'boolean', default: true },
    },
    required: ['tenant_id'],
  },
  handler: async (args, ctx) => {
    const { runPlatformAudit } = await import('@/lib/mcp/audit/platformAuditEngine');
    return runPlatformAudit({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      includeSlowQueries: args.include_slow_queries,
    });
  },
});
