import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { throwConnectorError } from '@/lib/mcp/connector/response';
import { getCanonicalWorkspaceCounts } from '@/lib/crm/canonicalWorkspaceStats';
import { getLifecycleConsistencyReport } from '@/lib/business/lifecycleConsistencyServer';

defineConnectorTool({
  module: 'reports-ops',
  name: 'dashboard_metrics',
  description: 'Core Alphaclone dashboard metrics: leads, deals, invoices, tasks, and MCP activity.',
  permission: 'reports:read',
  rateLimitClass: 'heavy',
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
    const countOf = async (table: string) => {
      const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id);
      return count ?? 0;
    };
    const [counts, mcpSessions, lifecycleConsistency] = await Promise.all([
      getCanonicalWorkspaceCounts(supabase, args.tenant_id),
      countOf('mcp_sessions'),
      getLifecycleConsistencyReport(supabase, args.tenant_id),
    ]);

    return {
      leads: counts.leads,
      contacts: counts.contacts,
      deals: counts.deals,
      invoices: counts.invoices,
      tasks: counts.open_tasks,
      open_tasks: counts.open_tasks,
      active_projects: counts.active_projects,
      unpaid_invoices: counts.unpaid_invoices,
      mcp_sessions: mcpSessions,
      lifecycle_consistency: lifecycleConsistency,
      stats_source: 'canonical_workspace_stats',
      generated_at: new Date().toISOString(),
    };
  },
});

defineConnectorTool({
  module: 'reports-ops',
  name: 'revenue_report',
  description: 'Revenue report over a date window from invoices and payments.',
  permission: 'reports:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    days: z.number().int().min(1).max(365).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();
    let { data, error } = await supabase
      .from('business_invoices')
      .select('id, status, total, amount_paid, currency, created_at, paid_at')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since)
      .limit(5000);

    if (error && (error.code === '42P01' || error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const fallback = await supabase
        .from('business_invoices')
        .select('id, status, total, created_at')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .limit(5000);
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const rows = (data || []).map((r: any) => ({
      ...r,
      total: Number(r.total ?? 0),
      amount_paid: Number(r.amount_paid ?? 0),
    }));
    const paid = rows.filter((r) => String(r.status).toLowerCase() === 'paid');
    return {
      window_days: args.days,
      invoice_count: rows.length,
      paid_count: paid.length,
      paid_revenue: paid.reduce((s, r) => s + (Number(r.amount_paid || r.total) || 0), 0),
      invoiced_total: rows.reduce((s, r) => s + (Number(r.total) || 0), 0),
      source: 'business_invoices',
    };
  },
});

defineConnectorTool({
  module: 'reports-ops',
  name: 'growth_report',
  description: 'Growth report: new leads, contacts, deals, and campaigns over a window.',
  permission: 'reports:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    days: z.number().int().min(1).max(365).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();
    const countSince = async (table: string) => {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since);
      return error ? null : count ?? 0;
    };

    return {
      window_days: args.days,
      new_leads: await countSince('leads'),
      new_contacts: await countSince('contacts'),
      new_deals: await countSince('deals'),
      new_campaigns: await countSince('campaigns'),
      generated_at: new Date().toISOString(),
    };
  },
});

defineConnectorTool({
  module: 'reports-ops',
  name: 'crm_pipeline_report',
  description: 'Evidence-based CRM funnel, source conversion, deal value, win/loss, and stale-record report. Missing data is reported as unavailable rather than estimated.',
  permission: 'reports:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    days: z.number().int().min(1).max(365).optional().default(90),
    stale_after_days: z.number().int().min(1).max(365).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number', minimum: 1, maximum: 365, default: 90 },
      stale_after_days: { type: 'number', minimum: 1, maximum: 365, default: 30 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();
    const staleBefore = new Date(Date.now() - args.stale_after_days * 86400000).toISOString();
    const [leadResult, dealResult] = await Promise.all([
      supabase
        .from('leads')
        .select('id, status, stage, source, client_id, created_at, updated_at')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .limit(5000),
      supabase
        .from('deals')
        .select('id, stage, value, source, created_at, updated_at')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .limit(5000),
    ]);
    if (leadResult.error) throwConnectorError('QUERY_FAILED', leadResult.error.message);
    if (dealResult.error) throwConnectorError('QUERY_FAILED', dealResult.error.message);

    const leads = leadResult.data || [];
    const deals = dealResult.data || [];
    const byLeadStage: Record<string, number> = {};
    const byDealStage: Record<string, { count: number; value: number }> = {};
    const bySource: Record<string, { leads: number; converted: number }> = {};
    const terminalWon = new Set(['won', 'closed_won', 'converted', 'customer']);
    const terminalLost = new Set(['lost', 'closed_lost', 'disqualified']);

    for (const lead of leads as any[]) {
      const stage = String(lead.stage || lead.status || 'unknown').toLowerCase();
      const source = String(lead.source || 'unknown');
      byLeadStage[stage] = (byLeadStage[stage] || 0) + 1;
      bySource[source] ||= { leads: 0, converted: 0 };
      bySource[source].leads += 1;
      if (lead.client_id || terminalWon.has(stage)) bySource[source].converted += 1;
    }
    for (const deal of deals as any[]) {
      const stage = String(deal.stage || 'unknown').toLowerCase();
      byDealStage[stage] ||= { count: 0, value: 0 };
      byDealStage[stage].count += 1;
      byDealStage[stage].value += Number(deal.value || 0);
    }

    const won = deals.filter((deal: any) => terminalWon.has(String(deal.stage || '').toLowerCase())).length;
    const lost = deals.filter((deal: any) => terminalLost.has(String(deal.stage || '').toLowerCase())).length;
    const closed = won + lost;
    const staleLeads = leads.filter((lead: any) => {
      const stage = String(lead.stage || lead.status || '').toLowerCase();
      return !lead.client_id && !terminalWon.has(stage) && !terminalLost.has(stage) && String(lead.updated_at || lead.created_at) < staleBefore;
    }).length;

    return {
      window_days: args.days,
      stale_after_days: args.stale_after_days,
      leads: { total: leads.length, stale: staleLeads, by_stage: byLeadStage },
      deals: {
        total: deals.length,
        total_value: deals.reduce((sum: number, deal: any) => sum + Number(deal.value || 0), 0),
        by_stage: byDealStage,
        won,
        lost,
        win_rate: closed > 0 ? Math.round((won / closed) * 1000) / 10 : null,
        win_rate_unavailable_reason: closed > 0 ? null : 'No closed won/lost deals in the selected period.',
      },
      source_conversion: Object.entries(bySource).map(([source, values]) => ({
        source,
        ...values,
        conversion_rate: values.leads > 0 ? Math.round((values.converted / values.leads) * 1000) / 10 : null,
      })),
      methodology: 'Counts use tenant-scoped CRM rows in the selected creation window. No benchmark, prior-period, or funnel values are inferred.',
      generated_at: new Date().toISOString(),
    };
  },
});

defineConnectorTool({
  module: 'reports-ops',
  name: 'customer_report',
  description: 'Customer report: active clients, stages, and recent activity.',
  permission: 'reports:read',
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
    const { data, error } = await supabase
      .from('business_clients')
      .select('id, name, email, sales_stage, value, is_active, updated_at')
      .eq('tenant_id', args.tenant_id)
      .limit(2000);
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const clients = data || [];
    const byStage: Record<string, number> = {};
    for (const c of clients) {
      const stage = String((c as any).sales_stage || 'unknown');
      byStage[stage] = (byStage[stage] || 0) + 1;
    }

    return {
      total_clients: clients.length,
      active_clients: clients.filter((c: any) => c.is_active !== false).length,
      by_stage: byStage,
      sample: clients.slice(0, 25),
    };
  },
});

defineConnectorTool({
  module: 'reports-ops',
  name: 'AI_usage_report',
  description: 'AI usage report: MCP tool calls, token/unit consumption signals, and failure rates.',
  permission: 'reports:read',
  rateLimitClass: 'heavy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    days: z.number().int().min(1).max(90).optional().default(7),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();
    const { data, error } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, duration_ms, created_at, metadata')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since)
      .limit(5000);
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const rows = data || [];
    const byTool: Record<string, { calls: number; failures: number; avg_ms: number }> = {};
    let failures = 0;
    let durationSum = 0;
    for (const row of rows) {
      const tool = String((row as any).tool_name || 'unknown');
      if (!byTool[tool]) byTool[tool] = { calls: 0, failures: 0, avg_ms: 0 };
      byTool[tool].calls += 1;
      const dur = Number((row as any).duration_ms) || 0;
      durationSum += dur;
      byTool[tool].avg_ms =
        (byTool[tool].avg_ms * (byTool[tool].calls - 1) + dur) / byTool[tool].calls;
      if ((row as any).success === false) {
        failures += 1;
        byTool[tool].failures += 1;
      }
    }

    return {
      window_days: args.days,
      total_calls: rows.length,
      failures,
      failure_rate: rows.length ? failures / rows.length : 0,
      avg_duration_ms: rows.length ? durationSum / rows.length : 0,
      by_tool: byTool,
      generated_at: new Date().toISOString(),
    };
  },
});
