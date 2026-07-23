import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'marketing-ops',
  name: 'campaigns',
  description: 'List marketing campaigns for the tenant.',
  permission: 'marketing:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    // Prefer email_campaigns; campaigns view maps to the same source
    let { data, error, count } = await supabase
      .from('email_campaigns')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error?.code === '42P01') {
      ({ data, error, count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('campaigns', { campaigns: data || [], source: 'email_campaigns' }, {
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
  module: 'marketing-ops',
  name: 'campaign_metrics',
  description: 'Return metrics for a campaign or aggregated campaign performance.',
  permission: 'marketing:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    campaign_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      campaign_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('email_campaigns')
      .select(
        'id, name, status, total_sent, total_opened, total_clicked, total_delivered, total_bounced, created_at, updated_at'
      )
      .eq('tenant_id', args.tenant_id);
    if (args.campaign_id) query = query.eq('id', args.campaign_id);
    let { data, error } = await query.limit(100);

    if (error?.code === '42P01') {
      let cQuery = supabase
        .from('campaigns')
        .select('id, name, status, metrics, stats, sent_count, open_count, click_count, created_at, updated_at')
        .eq('tenant_id', args.tenant_id);
      if (args.campaign_id) cQuery = cQuery.eq('id', args.campaign_id);
      const fallback = await cQuery.limit(100);
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const campaigns = (data || []).map((c: any) => ({
      ...c,
      sent_count: c.sent_count ?? c.total_sent ?? 0,
      open_count: c.open_count ?? c.total_opened ?? 0,
      click_count: c.click_count ?? c.total_clicked ?? 0,
      metrics: c.metrics || {
        total_sent: c.total_sent,
        total_opened: c.total_opened,
        total_clicked: c.total_clicked,
      },
    }));
    return { campaigns };
  },
});

defineConnectorTool({
  module: 'marketing-ops',
  name: 'email_campaigns',
  description: 'List email campaigns and delivery status.',
  permission: 'marketing:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    let { data, error, count } = await supabase
      .from('email_campaigns')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error?.code === '42P01') {
      ({ data, error, count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .ilike('type', '%email%')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('email_campaigns', { campaigns: data || [] }, {
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
  module: 'marketing-ops',
  name: 'funnels',
  description: 'List marketing funnels and stage conversion stats.',
  permission: 'marketing:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('funnels')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .order('updated_at', { ascending: false })
      .limit(args.limit);

    if (error?.code === '42P01' || (data || []).length === 0) {
      const { data: leads } = await supabase
        .from('leads')
        .select('stage')
        .eq('tenant_id', args.tenant_id)
        .limit(5000);
      const stages: Record<string, number> = {};
      for (const lead of leads || []) {
        const stage = String((lead as any).stage || 'unknown');
        stages[stage] = (stages[stage] || 0) + 1;
      }
      if (error?.code === '42P01' || Object.keys(stages).length > 0) {
        return {
          funnels: [
            {
              id: 'crm-pipeline',
              name: 'CRM Pipeline Funnel',
              stages,
              source: 'leads',
            },
          ],
        };
      }
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return { funnels: data || [] };
  },
});

defineConnectorTool({
  module: 'marketing-ops',
  name: 'landing_pages',
  description: 'List landing pages managed in Alphaclone.',
  permission: 'marketing:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .order('updated_at', { ascending: false })
      .limit(args.limit);

    if (error?.code === '42P01') {
      // No forms table in some deployments — return empty with source marker
      return { landing_pages: [], source: 'unavailable' };
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return { landing_pages: data || [] };
  },
});

defineConnectorTool({
  module: 'marketing-ops',
  name: 'conversions',
  description: 'List recent conversions / form submissions / won deals as conversion events.',
  permission: 'marketing:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
    days: z.number().int().min(1).max(90).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      days: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.days * 86400000).toISOString();

    const { data: formSubs } = await supabase
      .from('form_submissions')
      .select('id, form_id, created_at, payload, email')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    const { data: wonDeals } = await supabase
      .from('deals')
      .select('id, name, value, stage, updated_at')
      .eq('tenant_id', args.tenant_id)
      .in('stage', ['won', 'closed_won'])
      .gte('updated_at', since)
      .limit(args.limit);

    return {
      form_submissions: formSubs || [],
      won_deals: wonDeals || [],
      window_days: args.days,
    };
  },
});
