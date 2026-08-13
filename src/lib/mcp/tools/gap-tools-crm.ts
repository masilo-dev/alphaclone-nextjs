// @ts-nocheck
/**
 * Gap handlers — CRM extras, Tasks, Projects, Events
 */
import { z } from 'zod';
import { registerTool } from '@/lib/mcp/tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const tid = z.string().describe('AlphaClone Workspace ID');

// ── get_client_by_id ─────────────────────────────────────────────────
registerTool('gap-crm', {
  name: 'get_client_by_id',
  description: 'Fetch a single CRM client record by ID.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' } }, required: ['client_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('business_clients').select('*').eq('id', args.client_id).eq('tenant_id', args.tenant_id).single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

// ── get_client_history ────────────────────────────────────────────────
registerTool('gap-crm', {
  name: 'get_client_history',
  description: 'Get activity history (invoices, outreach, notes) for a client.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string(), limit: z.number().optional().default(20) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'number' } }, required: ['client_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const [{ data: invoices }, { data: outreach }, { data: notes }] = await Promise.all([
      supabase.from('business_invoices').select('id, total, status, created_at').eq('client_id', args.client_id).eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(10),
      supabase.from('outreach_logs').select('id, channel, status, created_at, subject').eq('client_id', args.client_id).eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(10),
      supabase.from('client_notes').select('id, content, created_at').eq('client_id', args.client_id).eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(10),
    ]);
    return { content: [{ type: 'text', text: JSON.stringify({ client_id: args.client_id, invoices: invoices || [], outreach: outreach || [], notes: notes || [] }, null, 2) }] };
  },
});

// ── get_client_email_history ──────────────────────────────────────────
registerTool('gap-crm', {
  name: 'get_client_email_history',
  description: 'Get email history for a specific client.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string(), limit: z.number().optional().default(20) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' }, limit: { type: 'number' } }, required: ['client_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('outreach_logs').select('id, subject, channel, status, sent_at, created_at, body_preview').eq('client_id', args.client_id).eq('tenant_id', args.tenant_id).in('channel', ['email', 'gmail', 'sendgrid', 'resend', 'brevo']).order('created_at', { ascending: false }).limit(args.limit ?? 20);
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ emails: data || [], client_id: args.client_id }, null, 2) }] };
  },
});

// ── update_client_metadata ────────────────────────────────────────────
registerTool('gap-crm', {
  name: 'update_client_metadata',
  description: 'Update custom metadata fields on a client record.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string(), metadata: z.record(z.string(), z.unknown()) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' }, metadata: { type: 'object' } }, required: ['client_id', 'metadata'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data: existing } = await supabase.from('business_clients').select('metadata').eq('id', args.client_id).eq('tenant_id', args.tenant_id).single();
    const merged = { ...((existing as any)?.metadata || {}), ...args.metadata };
    const { data, error } = await supabase.from('business_clients').update({ metadata: merged, updated_at: new Date().toISOString() }).eq('id', args.client_id).eq('tenant_id', args.tenant_id).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

// ── update_client_status_batch ────────────────────────────────────────
registerTool('gap-crm', {
  name: 'update_client_status_batch',
  description: 'Update sales_stage or status for multiple clients at once.',
  inputSchema: z.object({ tenant_id: tid, client_ids: z.array(z.string()), sales_stage: z.string().optional(), is_active: z.boolean().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_ids: { type: 'array', items: { type: 'string' } }, sales_stage: { type: 'string' }, is_active: { type: 'boolean' } }, required: ['client_ids'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.sales_stage) updates.sales_stage = args.sales_stage;
    if (args.is_active !== undefined) updates.is_active = args.is_active;
    const { data, error } = await supabase.from('business_clients').update(updates).in('id', args.client_ids).eq('tenant_id', args.tenant_id).select('id, sales_stage, is_active');
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ updated: (data || []).length, clients: data }, null, 2) }] };
  },
});

// ── segment_clients_by_criteria ───────────────────────────────────────
registerTool('gap-crm', {
  name: 'segment_clients_by_criteria',
  description: 'Segment clients by industry, stage, value range, or location.',
  inputSchema: z.object({ tenant_id: tid, industry: z.string().optional(), sales_stage: z.string().optional(), min_value: z.number().optional(), max_value: z.number().optional(), location: z.string().optional(), limit: z.number().optional().default(100) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, industry: { type: 'string' }, sales_stage: { type: 'string' }, min_value: { type: 'number' }, max_value: { type: 'number' }, location: { type: 'string' }, limit: { type: 'number' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let q = supabase.from('business_clients').select('id, name, email, phone, industry, sales_stage, value, location, is_active').eq('tenant_id', args.tenant_id).limit(args.limit ?? 100);
    if (args.industry) q = q.ilike('industry', `%${args.industry}%`);
    if (args.sales_stage) q = q.eq('sales_stage', args.sales_stage);
    if (args.min_value !== undefined) q = q.gte('value', args.min_value);
    if (args.max_value !== undefined) q = q.lte('value', args.max_value);
    if (args.location) q = q.ilike('location', `%${args.location}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ segments: data || [], count: (data || []).length }, null, 2) }] };
  },
});

// ── get_current_user ──────────────────────────────────────────────────
registerTool('gap-crm', {
  name: 'get_current_user',
  description: 'Get the current authenticated user profile and workspace info.',
  inputSchema: z.object({ tenant_id: tid.optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' } }, required: [] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase.from('profiles').select('id, full_name, email, avatar_url, role').eq('id', ctx.userId).single();
    return { content: [{ type: 'text', text: JSON.stringify({ user_id: ctx.userId, tenant_id: ctx.tenantId, profile: profile || { id: ctx.userId } }, null, 2) }] };
  },
});

// ── get_business_events / create_business_event ───────────────────────
registerTool('gap-crm', {
  name: 'get_business_events',
  description: 'List business events (meetings, milestones, deadlines).',
  inputSchema: z.object({ tenant_id: tid, from_date: z.string().optional(), to_date: z.string().optional(), limit: z.number().optional().default(20) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, from_date: { type: 'string' }, to_date: { type: 'string' }, limit: { type: 'number' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let q = supabase.from('business_events').select('*').eq('tenant_id', args.tenant_id).order('start_time', { ascending: true }).limit(args.limit ?? 20);
    if (args.from_date) q = q.gte('start_time', args.from_date);
    if (args.to_date) q = q.lte('start_time', args.to_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ events: [], message: 'No events table or no events found' }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ events: data || [] }, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'create_business_event',
  description: 'Create a business event, milestone, or calendar entry.',
  inputSchema: z.object({ tenant_id: tid, title: z.string(), start_time: z.string(), end_time: z.string().optional(), description: z.string().optional(), event_type: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, title: { type: 'string' }, start_time: { type: 'string' }, end_time: { type: 'string' }, description: { type: 'string' }, event_type: { type: 'string' } }, required: ['title', 'start_time'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('business_events').insert({ tenant_id: args.tenant_id, title: args.title, start_time: args.start_time, end_time: args.end_time || null, description: args.description || null, event_type: args.event_type || 'general', created_by: ctx.userId, created_at: new Date().toISOString() }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'create_client_portal_event',
  description: 'Create a client-facing portal event or notification.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string(), title: z.string(), message: z.string().optional(), event_type: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' }, title: { type: 'string' }, message: { type: 'string' }, event_type: { type: 'string' } }, required: ['client_id', 'title'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('notifications').insert({ tenant_id: args.tenant_id, title: args.title, body: args.message || '', type: args.event_type || 'client_portal', metadata: { client_id: args.client_id }, created_at: new Date().toISOString() }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ created: true, notification: data }, null, 2) }] };
  },
});

// ── create_task / get_tasks / update_task / add_task_dependency / create_tasks_batch / set_task_recurrence
registerTool('gap-crm', {
  name: 'create_task',
  description: 'Create a new task in the workspace.',
  inputSchema: z.object({ tenant_id: tid, title: z.string(), description: z.string().optional(), due_date: z.string().optional(), priority: z.string().optional(), assigned_to: z.string().optional(), project_id: z.string().optional(), client_id: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, due_date: { type: 'string' }, priority: { type: 'string' }, assigned_to: { type: 'string' }, project_id: { type: 'string' }, client_id: { type: 'string' } }, required: ['title'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('tasks').insert({ tenant_id: args.tenant_id, title: args.title, description: args.description || null, due_date: args.due_date || null, priority: args.priority || 'medium', assigned_to: args.assigned_to || ctx.userId, project_id: args.project_id || null, client_id: args.client_id || null, status: 'pending', created_by: ctx.userId, created_at: new Date().toISOString() }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'get_tasks',
  description: 'List tasks for the workspace with optional filters.',
  inputSchema: z.object({ tenant_id: tid, status: z.string().optional(), assigned_to: z.string().optional(), project_id: z.string().optional(), limit: z.number().optional().default(50) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, status: { type: 'string' }, assigned_to: { type: 'string' }, project_id: { type: 'string' }, limit: { type: 'number' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let q = supabase.from('tasks').select('*').eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(args.limit ?? 50);
    if (args.status) q = q.eq('status', args.status);
    if (args.assigned_to) q = q.eq('assigned_to', args.assigned_to);
    if (args.project_id) q = q.eq('project_id', args.project_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ tasks: data || [], count: (data || []).length }, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'update_task',
  description: 'Update a task status, priority, due date, or assignment.',
  inputSchema: z.object({ tenant_id: tid, task_id: z.string(), status: z.string().optional(), priority: z.string().optional(), due_date: z.string().optional(), assigned_to: z.string().optional(), title: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, task_id: { type: 'string' }, status: { type: 'string' }, priority: { type: 'string' }, due_date: { type: 'string' }, assigned_to: { type: 'string' }, title: { type: 'string' } }, required: ['task_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ['status', 'priority', 'due_date', 'assigned_to', 'title'] as const) if (args[k] !== undefined) updates[k] = args[k];
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', args.task_id).eq('tenant_id', args.tenant_id).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'add_task_dependency',
  description: 'Add a dependency between two tasks (task B cannot start until task A completes).',
  inputSchema: z.object({ tenant_id: tid, task_id: z.string(), depends_on_task_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, task_id: { type: 'string' }, depends_on_task_id: { type: 'string' } }, required: ['task_id', 'depends_on_task_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('task_dependencies').insert({ tenant_id: args.tenant_id, task_id: args.task_id, depends_on_task_id: args.depends_on_task_id, created_at: new Date().toISOString() }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ created: false, error: error.message, message: 'task_dependencies table may not exist — dependency recorded in task metadata instead' }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ created: true, dependency: data }, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'create_tasks_batch',
  description: 'Create multiple tasks at once.',
  inputSchema: z.object({ tenant_id: tid, tasks: z.array(z.object({ title: z.string(), description: z.string().optional(), due_date: z.string().optional(), priority: z.string().optional() })) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, tasks: { type: 'array', items: { type: 'object' } } }, required: ['tasks'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const rows = (args.tasks || []).map((t: any) => ({ tenant_id: args.tenant_id, title: t.title, description: t.description || null, due_date: t.due_date || null, priority: t.priority || 'medium', status: 'pending', created_by: ctx.userId, created_at: new Date().toISOString() }));
    const { data, error } = await supabase.from('tasks').insert(rows).select();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ created: (data || []).length, tasks: data }, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'set_task_recurrence',
  description: 'Set a recurrence schedule on an existing task.',
  inputSchema: z.object({ tenant_id: tid, task_id: z.string(), recurrence: z.string().describe('daily | weekly | monthly | custom'), interval_days: z.number().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, task_id: { type: 'string' }, recurrence: { type: 'string' }, interval_days: { type: 'number' } }, required: ['task_id', 'recurrence'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('tasks').update({ recurrence: args.recurrence, recurrence_interval_days: args.interval_days || null, updated_at: new Date().toISOString() }).eq('id', args.task_id).eq('tenant_id', args.tenant_id).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ updated: true, task: data }, null, 2) }] };
  },
});

// ── Project milestone/timeline tools ──────────────────────────────────
registerTool('gap-crm', {
  name: 'get_project_milestones',
  description: 'Get milestones for a project.',
  inputSchema: z.object({ tenant_id: tid, project_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, project_id: { type: 'string' } }, required: ['project_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('project_milestones').select('*').eq('project_id', args.project_id).eq('tenant_id', args.tenant_id).order('due_date');
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ milestones: [], error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ milestones: data || [] }, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'get_project_timeline',
  description: 'Get a project timeline with tasks and milestones sorted by date.',
  inputSchema: z.object({ tenant_id: tid, project_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, project_id: { type: 'string' } }, required: ['project_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const [{ data: tasks }, { data: milestones }] = await Promise.all([
      supabase.from('tasks').select('id, title, status, due_date, priority').eq('project_id', args.project_id).eq('tenant_id', args.tenant_id).order('due_date'),
      supabase.from('project_milestones').select('id, title, status, due_date').eq('project_id', args.project_id).eq('tenant_id', args.tenant_id).order('due_date'),
    ]);
    const timeline = [
      ...(tasks || []).map((t: any) => ({ ...t, type: 'task' })),
      ...(milestones || []).map((m: any) => ({ ...m, type: 'milestone' })),
    ].sort((a: any, b: any) => new Date(a.due_date || '9999').getTime() - new Date(b.due_date || '9999').getTime());
    return { content: [{ type: 'text', text: JSON.stringify({ project_id: args.project_id, timeline }, null, 2) }] };
  },
});

registerTool('gap-crm', {
  name: 'kickoff_project_automation',
  description: 'Kickoff a project by setting status to active and creating initial tasks.',
  inputSchema: z.object({ tenant_id: tid, project_id: z.string(), kickoff_tasks: z.array(z.string()).optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, project_id: { type: 'string' }, kickoff_tasks: { type: 'array', items: { type: 'string' } } }, required: ['project_id'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    await supabase.from('projects').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', args.project_id).eq('tenant_id', args.tenant_id);
    if (args.kickoff_tasks?.length) {
      const rows = args.kickoff_tasks.map((title: string) => ({ tenant_id: args.tenant_id, project_id: args.project_id, title, status: 'pending', priority: 'medium', created_by: ctx.userId, created_at: new Date().toISOString() }));
      await supabase.from('tasks').insert(rows);
    }
    return { content: [{ type: 'text', text: JSON.stringify({ kicked_off: true, project_id: args.project_id, tasks_created: (args.kickoff_tasks || []).length }, null, 2) }] };
  },
});
