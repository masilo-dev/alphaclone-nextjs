import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';

defineConnectorTool({
  module: 'calendar-ops',
  name: 'events',
  description: 'List calendar / business events for the tenant.',
  permission: 'calendar:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { limit, offset } = normalizePagination(args);
    // Prefer calendar_events (canonical). Avoid EventBus `events` table.
    let query = supabase
      .from('calendar_events')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1);
    if (args.from) query = query.gte('start_time', args.from);
    if (args.to) query = query.lte('start_time', args.to);

    let { data, error, count } = await query;
    if (error && (error.code === '42703' || /start_time|does not exist/i.test(error.message || ''))) {
      ({ data, error, count } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('events', { events: data || [], source: 'calendar_events' }, {
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
  module: 'calendar-ops',
  name: 'tasks',
  description: 'List tasks assigned in Alphaclone.',
  permission: 'calendar:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
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
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (args.status) query = query.eq('status', args.status);
    const { data, error, count } = await query;
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('tasks', { tasks: data || [] }, {
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
  module: 'calendar-ops',
  name: 'reminders',
  description: 'List upcoming reminders (task reminders, invoice reminders, scheduled AI tasks).',
  permission: 'calendar:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
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
    const now = new Date().toISOString();

    const { data: taskReminders } = await supabase
      .from('tasks')
      .select('id, title, due_date, status, reminder_at')
      .eq('tenant_id', args.tenant_id)
      .not('reminder_at', 'is', null)
      .gte('reminder_at', now)
      .order('reminder_at', { ascending: true })
      .limit(args.limit);

    const { data: scheduledAi } = await supabase
      .from('scheduled_ai_tasks')
      .select('id, task_type, run_at, status')
      .eq('tenant_id', args.tenant_id)
      .gte('run_at', now)
      .order('run_at', { ascending: true })
      .limit(args.limit);

    return {
      task_reminders: taskReminders || [],
      scheduled_ai_tasks: scheduledAi || [],
    };
  },
});

defineConnectorTool({
  module: 'calendar-ops',
  name: 'appointments',
  description: 'List appointments / meetings / Calendly-synced bookings.',
  permission: 'calendar:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(50),
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

    // Prefer appointments view (maps calendar_events) then calendar_events directly
    let { data, error, count } = await supabase
      .from('calendar_events')
      .select('*', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('start_time', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error && (error.code === '42703' || /start_time|does not exist/i.test(error.message || ''))) {
      ({ data, error, count } = await supabase
        .from('calendar_events')
        .select('*', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1));
    }

    if (error?.code === '42P01') {
      ({ data, error, count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .order('start_at', { ascending: true })
        .range(offset, offset + limit - 1));
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return okResult('appointments', { appointments: data || [], source: 'calendar_events' }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: (data || []).length,
        total: count ?? null,
      }),
    });
  },
});
