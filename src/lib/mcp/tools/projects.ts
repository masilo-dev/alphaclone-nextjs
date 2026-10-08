import './projects-v2-intelligence';
import { z } from 'zod';
import { updatePersistedProject } from '@/lib/projects/projectPersistence';
import { normalizeProjectStatus } from '@/lib/projects/projectEnums';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const PROJECT_TABLE = 'business_projects';

async function queryProjects(supabase: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, status?: string) {
  const rows = new Map<string, any>();
  for (const table of ['projects', PROJECT_TABLE]) {
    let query = supabase.from(table).select('*').eq('tenant_id', tenantId);
    if (status) query = query.eq('status', table === 'projects' ? normalizeProjectStatus(status) || status : status);
    const {data, error} = await query;
    if (error) throw error;
    for (const row of data || []) if (!rows.has(row.id)) rows.set(row.id, row);
  }
  return [...rows.values()];
}

registerTool('projects', {
  name: 'update_project_status', description: 'Update a tenant project status and return the persisted row.',
  inputSchema: z.object({tenant_id: z.string().uuid(), project_id: z.string().uuid(), status: z.string().min(1), notes: z.string().optional()}),
  jsonSchema: {type: 'object', properties: {tenant_id: {type: 'string', format: 'uuid'}, project_id: {type: 'string', format: 'uuid'}, status: {type: 'string'}, notes: {type: 'string'}}, required: ['tenant_id', 'project_id', 'status']},
  handler: async args => updatePersistedProject(createSupabaseAdminClient(), args.tenant_id, args.project_id, {status: args.status, ...(args.notes === undefined ? {} : {description: args.notes})}),
});

// 1. get_projects
registerTool('projects', {
  name: 'get_projects',
  description: 'Retrieve projects for a tenant, optionally filtered by status.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    status: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', description: 'Filter by project status (e.g. active, completed)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    return queryProjects(supabase, args.tenant_id, args.status);
  },
});

// 2. create_project
registerTool('projects', {
  name: 'create_project',
  description: 'Create a new project linked to an optional client.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string().trim().min(1),
    client_id: z.string().uuid().optional(),
    status: z.string().optional().default('active'),
    description: z.string().optional(),
    due_date: z.string().optional(),
    idempotency_key: z.string().min(1).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      client_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', default: 'active' },
      description: { type: 'string' },
      due_date: { type: 'string', format: 'date-time' },
      idempotency_key: {type: 'string'},
    },
    required: ['tenant_id', 'name'],
  },
  handler: async (args, context) => {
    const { executeProjectCreateCommand } = await import(
      '@/lib/execution/commands/projectCreateCommand'
    );
    const execution = await executeProjectCreateCommand({
      tenantId: args.tenant_id,
      userId: context.userId || '',
      executionSource: 'mcp',
      skipPolicyEvaluation: true,
      idempotencyKey:
        typeof (args as { idempotency_key?: string }).idempotency_key === 'string'
          ? (args as { idempotency_key?: string }).idempotency_key
          : undefined,
      input: {
        name: args.name,
        clientId: args.client_id,
        status: args.status,
        description: args.description,
        dueDate: args.due_date,
      },
    });
    if (!execution.ok || !execution.result) {
      throw Object.assign(new Error(execution.error?.message || 'Failed to create project'), {code: execution.error?.code || 'PROJECT_CREATE_FAILED'});
    }
    return {
      ...execution.result.project,
      created: execution.result.created,
      duplicate: execution.result.duplicate,
      receipt: {action_id: execution.execution_id, status: 'verified', entity_type: 'project', entity_id: String(execution.result.project.id), timestamp: new Date().toISOString()},
      execution_id: execution.execution_id,
      idempotency_key: execution.idempotency_key,
    };
  },
});

// 3. update_project
registerTool('projects', {
  name: 'update_project',
  description: 'Update project fields.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    project_id: z.string().uuid(),
    fields: z.object({
      name: z.string().optional(),
      status: z.string().optional(),
      description: z.string().optional(),
      client_id: z.string().uuid().optional(),
      due_date: z.string().optional(),
    }),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      project_id: { type: 'string', format: 'uuid' },
      fields: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string' },
          description: { type: 'string' },
          client_id: { type: 'string', format: 'uuid' },
          due_date: { type: 'string', format: 'date-time' },
        },
      },
    },
    required: ['tenant_id', 'project_id', 'fields'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    return updatePersistedProject(supabase, args.tenant_id, args.project_id, args.fields);
  },
});

// 4. get_project_tasks
registerTool('projects', {
  name: 'get_project_tasks',
  description: 'Retrieve tasks related to a specific project.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    project_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      project_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'project_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('related_to_project', args.project_id)
      .eq('tenant_id', args.tenant_id);

    if (error) throw error;
    return data;
  },
});

// 5. create_project_task
registerTool('projects', {
  name: 'create_project_task',
  description: 'Create a task related to a project.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    project_id: z.string().uuid(),
    title: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    status: z.enum(['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled']).optional().default('todo'),
    due_date: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      project_id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
      status: { type: 'string', enum: ['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled'], default: 'todo' },
      due_date: { type: 'string', format: 'date-time' },
    },
    required: ['tenant_id', 'project_id', 'title'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        tenant_id: args.tenant_id,
        related_to_project: args.project_id,
        title: args.title,
        priority: args.priority,
        status: args.status,
        due_date: args.due_date || null,
        created_by: ctx.userId || null,
      })
      .select()
      .single();

    if (error) throw error;

    if (data?.related_to_project) {
      try {
        await supabase.from('project_comments').insert({
          tenant_id: args.tenant_id,
          project_id: args.project_id,
          author_name: 'AlphaClone System',
          content: `Task created: ${data.title}${data.due_date ? `, due ${data.due_date}` : ''}.`,
          is_client: false,
        });
      } catch (_) {
        // Non-critical: the task itself was created successfully.
      }
    }

    return data;
  },
});

// 6. update_project_task
registerTool('projects', {
  name: 'update_project_task',
  description: 'Update project task fields.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    task_id: z.string().uuid(),
    fields: z.object({
      title: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      status: z.enum(['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
      description: z.string().optional(),
      due_date: z.string().optional(),
    }),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      task_id: { type: 'string', format: 'uuid' },
      fields: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          status: { type: 'string', enum: ['ideas', 'todo', 'in_progress', 'review', 'completed', 'cancelled'] },
          description: { type: 'string' },
          due_date: { type: 'string', format: 'date-time' },
        },
      },
    },
    required: ['tenant_id', 'task_id', 'fields'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...args.fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.task_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
});

// 7. get_project_details
registerTool('projects', {
  name: 'get_project_details',
  description: 'Get project with linked client, deals, invoices, and contracts.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    project_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      project_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'project_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data: bizProject } = await supabase
      .from('projects')
      .select('*')
      .eq('id', args.project_id)
      .eq('tenant_id', args.tenant_id)
      .maybeSingle();

    const project =
      bizProject ||
      (
        await supabase
          .from(PROJECT_TABLE)
          .select('*')
          .eq('id', args.project_id)
          .eq('tenant_id', args.tenant_id)
          .maybeSingle()
      ).data;

    if (!project) throw new Error('Project not found');

    const clientId = (project as { client_id?: string }).client_id;
    const [client, deals, invoices, contracts, tasks] = await Promise.all([
      clientId
        ? supabase
            .from('business_clients')
            .select('id, name, email')
            .eq('id', clientId)
            .eq('tenant_id', args.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      clientId
        ? supabase.from('deals').select('id, title, stage, value').eq('client_id', clientId).eq('tenant_id', args.tenant_id)
        : supabase.from('deals').select('id, title, stage, value').eq('project_id', args.project_id).eq('tenant_id', args.tenant_id),
      supabase.from('business_invoices').select('id, invoice_number, status, total_amount').eq('project_id', args.project_id).eq('tenant_id', args.tenant_id),
      supabase.from('contracts').select('id, title, status').eq('project_id', args.project_id).eq('tenant_id', args.tenant_id),
      supabase.from('tasks').select('id, title, status, priority, due_date').eq('related_to_project', args.project_id).eq('tenant_id', args.tenant_id),
    ]);

    return {
      project,
      linked_client: client.data,
      linked_deals: deals.data || [],
      linked_invoices: invoices.data || [],
      linked_contracts: contracts.data || [],
      tasks: tasks.data || [],
    };
  },
});
