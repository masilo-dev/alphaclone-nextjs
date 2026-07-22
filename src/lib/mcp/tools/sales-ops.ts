import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'sales-ops',
  name: 'invoices',
  description: 'List invoices with pagination and optional status filter.',
  permission: 'sales:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (args.status) query = query.eq('status', args.status);
    const { data, error, count } = await query;
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('invoices', { invoices: data || [] }, {
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
  module: 'sales-ops',
  name: 'quotes',
  description: 'List sales quotes / estimates.',
  permission: 'sales:read',
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
    const { data, error, count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('quotes', { quotes: data || [] }, {
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
  module: 'sales-ops',
  name: 'payments',
  description: 'List recorded payments / invoice payment events.',
  permission: 'sales:read',
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
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error?.code === '42P01') {
      ({ data, error, count } = await supabase
        .from('invoice_payments')
        .select('*', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('payments', { payments: data || [] }, {
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
  module: 'sales-ops',
  name: 'subscriptions',
  description: 'List Stripe/subscription records for the tenant.',
  permission: 'sales:read',
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
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error?.code === '42P01') {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, plan, stripe_customer_id, stripe_subscription_id, subscription_status')
        .eq('id', args.tenant_id)
        .maybeSingle();
      return { subscriptions: tenant ? [tenant] : [], source: 'tenants' };
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return { subscriptions: data || [] };
  },
});

defineConnectorTool({
  module: 'sales-ops',
  name: 'revenue_dashboard',
  description: 'Revenue dashboard snapshot: invoices, payments, pipeline value, and MRR signals.',
  permission: 'sales:read',
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

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, status, total, amount_due, amount_paid, created_at, paid_at')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since)
      .limit(2000);

    const paid = (invoices || []).filter((i: any) => String(i.status).toLowerCase() === 'paid');
    const outstanding = (invoices || []).filter((i: any) =>
      ['sent', 'overdue', 'partial'].includes(String(i.status).toLowerCase())
    );

    const paidTotal = paid.reduce((s: number, i: any) => s + (Number(i.total || i.amount_paid) || 0), 0);
    const outstandingTotal = outstanding.reduce(
      (s: number, i: any) => s + (Number(i.amount_due || i.total) || 0),
      0
    );

    const { data: deals } = await supabase
      .from('deals')
      .select('value, stage')
      .eq('tenant_id', args.tenant_id)
      .limit(2000);
    const pipelineValue = (deals || [])
      .filter((d: any) => !['won', 'lost', 'closed_won', 'closed_lost'].includes(String(d.stage)))
      .reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

    return {
      window_days: args.days,
      invoices_created: (invoices || []).length,
      paid_total: paidTotal,
      outstanding_total: outstandingTotal,
      pipeline_value: pipelineValue,
      generated_at: new Date().toISOString(),
    };
  },
});
