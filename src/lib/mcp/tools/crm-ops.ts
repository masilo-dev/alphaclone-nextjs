import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { getUnifiedContacts } from '@/lib/crm/unifiedContacts';
import { onLeadCreated } from '@/lib/leads/leadOnCreated';
import { normalizePhoneForStorage } from '@/lib/phone/leadPhone';

defineConnectorTool({
  module: 'crm-ops',
  name: 'list_leads',
  description: 'List CRM leads with pagination and filters (ChatGPT-friendly alias of the lead pipeline).',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    status: z.string().optional(),
    stage: z.string().optional(),
    source: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
    exclude_converted: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string' },
      stage: { type: 'string' },
      source: { type: 'string' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      exclude_converted: { type: 'boolean' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const { fetchLeadsPaginated } = await import('@/lib/crm/fetchLeads');
    return fetchLeadsPaginated({
      tenantId: args.tenant_id,
      status: args.status,
      stage: args.stage,
      source: args.source,
      limit: args.limit,
      offset: args.offset,
      excludeConverted: args.exclude_converted,
    });
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'search_leads',
  description: 'Search CRM leads by name, email, phone, company, or free-text query.',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    const q = args.query.replace(/[%_,]/g, ' ').trim();
    const orFilter = [
      `business_name.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `phone.ilike.%${q}%`,
      `notes.ilike.%${q}%`,
      `contact_name.ilike.%${q}%`,
    ].join(',');

    let query = supabase
      .from('leads')
      .select(
        'id, tenant_id, owner_id, business_name, contact_name, email, phone, industry, location, source, stage, status, value, notes, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('tenant_id', args.tenant_id)
      .or(orFilter)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    let { data, error, count } = await query;

    // Compatibility: if contact_name/updated_at/status not yet migrated, retry with core columns.
    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const fallback = await supabase
        .from('leads')
        .select(
          'id, tenant_id, owner_id, business_name, email, phone, industry, location, source, stage, value, notes, created_at',
          { count: 'exact' }
        )
        .eq('tenant_id', args.tenant_id)
        .or(`business_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,notes.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      data = fallback.data as typeof data;
      error = fallback.error;
      count = fallback.count;
    }

    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('search_leads', { leads: data || [], query: args.query }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
      receipt: null,
    });
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'create_lead',
  description: 'Create a new CRM lead in Alphaclone.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_create_lead',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    business_name: z.string().optional(),
    contact_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    linkedin_url: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      business_name: { type: 'string' },
      contact_name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string' },
      industry: { type: 'string' },
      location: { type: 'string' },
      source: { type: 'string' },
      notes: { type: 'string' },
      linkedin_url: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, ctx) => {
    const primaryName = (args.business_name || args.contact_name || '').trim();
    if (!primaryName) throwConnectorError('VALIDATION_ERROR', 'business_name or contact_name is required');

    const supabase = createSupabaseAdminClient();
    const phone = normalizePhoneForStorage(args.phone);
    const now = new Date().toISOString();
    const fullPayload: Record<string, unknown> = {
      tenant_id: args.tenant_id,
      owner_id: ctx.userId,
      business_name: primaryName,
      contact_name: args.contact_name || null,
      email: args.email || null,
      phone: phone || null,
      industry: args.industry || null,
      location: args.location || null,
      source: args.source || 'mcp_connector',
      notes: args.notes || null,
      linkedin_url: args.linkedin_url || null,
      status: 'new',
      stage: 'new',
      created_at: now,
      updated_at: now,
    };

    let { data, error } = await supabase.from('leads').insert(fullPayload).select().single();
    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const minimal = {
        tenant_id: args.tenant_id,
        owner_id: ctx.userId,
        business_name: primaryName,
        email: args.email || null,
        phone: phone || null,
        industry: args.industry || null,
        location: args.location || null,
        source: args.source || 'mcp_connector',
        notes: args.notes || null,
        stage: 'new',
        created_at: now,
      };
      ({ data, error } = await supabase.from('leads').insert(minimal).select().single());
    }

    if (error) throwConnectorError('CREATE_FAILED', error.message);
    try {
      await onLeadCreated({ tenantId: args.tenant_id, leadId: data.id, userId: ctx.userId });
    } catch (hookErr) {
      console.warn('[create_lead] onLeadCreated:', hookErr);
    }
    return data;
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'update_lead',
  description: 'Update an existing CRM lead by id.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'mcp_update_lead',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    lead_id: z.string().uuid(),
    business_name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    stage: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid' },
      business_name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      industry: { type: 'string' },
      location: { type: 'string' },
      source: { type: 'string' },
      notes: { type: 'string' },
      status: { type: 'string' },
      stage: { type: 'string' },
    },
    required: ['tenant_id', 'lead_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'business_name',
      'email',
      'industry',
      'location',
      'source',
      'notes',
      'status',
      'stage',
    ] as const) {
      if (args[key] !== undefined) updates[key] = args[key];
    }
    if (args.phone !== undefined) updates.phone = normalizePhoneForStorage(args.phone);

    let { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.lead_id)
      .select()
      .maybeSingle();

    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const fallback: Record<string, unknown> = {};
      for (const key of ['business_name', 'email', 'industry', 'location', 'source', 'notes', 'stage'] as const) {
        if (args[key] !== undefined) fallback[key] = args[key];
      }
      if (args.phone !== undefined) fallback.phone = normalizePhoneForStorage(args.phone);
      ({ data, error } = await supabase
        .from('leads')
        .update(fallback)
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.lead_id)
        .select()
        .maybeSingle());
    }

    if (error) throwConnectorError('UPDATE_FAILED', error.message);
    if (!data) throwConnectorError('RESOURCE_NOT_FOUND', `Lead with id ${args.lead_id} was not found in this workspace`);
    return data;
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'delete_lead',
  description: 'Delete (or soft-archive) a CRM lead. Destructive — requires crm:delete permission.',
  permission: 'crm:delete',
  rateLimitClass: 'write',
  auditAction: 'mcp_delete_lead',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    lead_id: z.string().uuid(),
    hard_delete: z.boolean().optional().default(false),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid' },
      hard_delete: { type: 'boolean', default: false },
    },
    required: ['tenant_id', 'lead_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    if (args.hard_delete) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.lead_id);
      if (error) throwConnectorError('DELETE_FAILED', error.message);
      return { deleted: true, lead_id: args.lead_id, mode: 'hard' };
    }

    let { data, error } = await supabase
      .from('leads')
      .update({
        status: 'archived',
        stage: 'closed_lost',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.lead_id)
      .select('id, status, stage')
      .single();

    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      ({ data, error } = await supabase
        .from('leads')
        .update({ stage: 'closed_lost' })
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.lead_id)
        .select('id, stage')
        .single());
    }

    if (error) throwConnectorError('DELETE_FAILED', error.message);
    return { deleted: true, lead: data, mode: 'soft_archive' };
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'list_contacts',
  description: 'List unified CRM contacts for the tenant.',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      search: { type: 'string' },
      status: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    return getUnifiedContacts(supabase, args.tenant_id, {
      limit: args.limit,
      search: args.search,
      status: args.status,
    });
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'list_companies',
  description: 'List companies / business clients in the CRM.',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
    search: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      search: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    let query = supabase
      .from('business_clients')
      .select('id, name, email, phone, company, industry, sales_stage, value, is_active, created_at, updated_at', {
        count: 'exact',
      })
      .eq('tenant_id', args.tenant_id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (args.search) {
      const q = args.search.replace(/[%_]/g, '');
      query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('list_companies', { companies: data || [] }, {
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
  module: 'crm-ops',
  name: 'pipeline_status',
  description: 'Summarize CRM pipeline stages, counts, and conversion health.',
  permission: 'crm:read',
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
    let { data: leads, error } = await supabase
      .from('leads')
      .select('id, stage, status, created_at, updated_at')
      .eq('tenant_id', args.tenant_id)
      .limit(5000);

    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const fallback = await supabase
        .from('leads')
        .select('id, stage, created_at')
        .eq('tenant_id', args.tenant_id)
        .limit(5000);
      leads = fallback.data as typeof leads;
      error = fallback.error;
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const byStage: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const lead of leads || []) {
      const stage = String((lead as any).stage || 'unknown');
      const status = String((lead as any).status || (lead as any).stage || 'unknown');
      byStage[stage] = (byStage[stage] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    const { data: deals } = await supabase
      .from('deals')
      .select('id, stage, value')
      .eq('tenant_id', args.tenant_id)
      .limit(2000);

    const dealValue = (deals || []).reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);

    return {
      lead_count: (leads || []).length,
      by_stage: byStage,
      by_status: byStatus,
      open_deals: (deals || []).length,
      open_deal_value: dealValue,
    };
  },
});

defineConnectorTool({
  module: 'crm-ops',
  name: 'opportunities',
  description: 'List sales opportunities / deals in the CRM pipeline.',
  permission: 'crm:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
    stage: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      stage: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    let query = supabase
      .from('deals')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (args.stage) query = query.eq('stage', args.stage);
    const { data, error, count } = await query;
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('opportunities', { opportunities: data || [] }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
    });
  },
});
