import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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
    let query = supabase
      .from('projects')
      .select('*')
      .eq('tenant_id', args.tenant_id);

    if (args.status) {
      query = query.eq('status', args.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
});

// 2. create_project
registerTool('projects', {
  name: 'create_project',
  description: 'Create a new project.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    name: z.string(),
    status: z.string().optional().default('active'),
    description: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      status: { type: 'string', default: 'active' },
      description: { type: 'string' },
    },
    required: ['tenant_id', 'name'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        tenant_id: args.tenant_id,
        name: args.name,
        status: args.status,
        description: args.description || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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
        },
      },
    },
    required: ['tenant_id', 'project_id', 'fields'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...args.fields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.project_id)
      .eq('tenant_id', args.tenant_id)
      .select()
      .single();

    if (error) throw error;
    return data;
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
