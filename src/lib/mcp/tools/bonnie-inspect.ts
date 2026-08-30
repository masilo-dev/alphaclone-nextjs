import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildPaginationMeta, normalizePagination } from '@/lib/mcp/connector/pagination';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { getUnifiedMcpTools } from '@/lib/mcp/listAllTools';
import {
  listRegisteredAgents,
} from '@/lib/bonnie/os';

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'list_conversations',
  description: 'List Bonnie / Alphaclone AI conversations for the tenant with pagination.',
  permission: 'bonnie:read',
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

    const tryTables = ['ai_conversations', 'chatbot_conversations'] as const;
    for (const table of tryTables) {
      const { data, error, count } = await supabase
        .from(table)
        .select('id, title, channel, status, created_at, updated_at, user_id, metadata', { count: 'exact' })
        .eq('tenant_id', args.tenant_id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (!error) {
        return okResult('list_conversations', { conversations: data || [], source: table }, {
          pagination: buildPaginationMeta({
            limit,
            offset,
            returned: (data || []).length,
            total: count ?? null,
          }),
        });
      }
      if (error.code !== '42P01') throwConnectorError('QUERY_FAILED', error.message);
    }

    const { data, error, count } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, created_at, success, user_id, metadata', { count: 'exact' })
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throwConnectorError('QUERY_FAILED', error.message);

    const conversations = (data || []).map((row: any) => ({
      id: row.id,
      title: row.tool_name || 'MCP session',
      channel: 'mcp',
      status: row.success === false ? 'error' : 'completed',
      created_at: row.created_at,
      updated_at: row.created_at,
      user_id: row.user_id,
      metadata: row.metadata,
    }));

    return okResult('list_conversations', { conversations, source: 'mcp_sessions' }, {
      pagination: buildPaginationMeta({
        limit,
        offset,
        returned: conversations.length,
        total: count ?? null,
      }),
    });
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'get_conversation',
  description: 'Retrieve a single Bonnie conversation with messages / reasoning turns.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    conversation_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      conversation_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'conversation_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    let conversation: Record<string, unknown> | null = null;

    const primary = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.conversation_id)
      .maybeSingle();

    if (!primary.error) {
      conversation = primary.data;
    } else if (primary.error.code !== '42P01') {
      throwConnectorError('QUERY_FAILED', primary.error.message);
    }

    if (!conversation) {
      const fallback = await supabase
        .from('chatbot_conversations')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .eq('id', args.conversation_id)
        .maybeSingle();
      if (fallback.error && fallback.error.code !== '42P01') {
        throwConnectorError('QUERY_FAILED', fallback.error.message);
      }
      conversation = fallback.data;
    }

    if (!conversation) throwConnectorError('NOT_FOUND', 'Conversation not found');

    let messages: any[] = [];
    const { data: msgRows, error: msgErr } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at, metadata, tool_calls')
      .eq('tenant_id', args.tenant_id)
      .eq('conversation_id', args.conversation_id)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!msgErr) messages = msgRows || [];
    else if (msgErr.code === '42P01') {
      const { data: fallbackMsgs } = await supabase
        .from('chatbot_messages')
        .select('id, role, content, created_at, metadata')
        .eq('conversation_id', args.conversation_id)
        .order('created_at', { ascending: true })
        .limit(200);
      messages = fallbackMsgs || [];
    }

    return { conversation, messages };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'list_workflows',
  description: 'List available Bonnie automation playbooks / workflows and recent runs.',
  permission: 'bonnie:read',
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
    const { listBuiltInPlaybooks } = await import('@/services/automation/playbookService');
    const playbooks = listBuiltInPlaybooks();
    const supabase = createSupabaseAdminClient();
    const { data: runs } = await supabase
      .from('automation_runs')
      .select('id, playbook_id, status, created_at, updated_at, error')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    return {
      playbooks: playbooks.map((p: any) => ({
        id: p.id,
        name: p.name || p.id,
        description: p.description || null,
        steps: Array.isArray(p.steps) ? p.steps.length : undefined,
      })),
      recent_runs: runs || [],
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'get_workflow',
  description: 'Get a workflow/playbook definition and latest run status.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    workflow_id: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      workflow_id: { type: 'string' },
    },
    required: ['tenant_id', 'workflow_id'],
  },
  handler: async (args) => {
    const { listBuiltInPlaybooks } = await import('@/services/automation/playbookService');
    const playbooks = listBuiltInPlaybooks();
    const playbook = playbooks.find((p: any) => p.id === args.workflow_id || p.name === args.workflow_id);
    if (!playbook) throwConnectorError('NOT_FOUND', `Workflow ${args.workflow_id} not found`);

    const supabase = createSupabaseAdminClient();
    const { data: runs } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('playbook_id', (playbook as any).id)
      .order('created_at', { ascending: false })
      .limit(10);

    return { workflow: playbook, recent_runs: runs || [] };
  },
});

// run_workflow and stop_workflow are registered in autonomous-ops.ts (canonical handlers).

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_agent_reasoning',
  description:
    'Inspect Bonnie agent reasoning traces for a cognitive loop, orchestration, or dream session.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    session_id: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional().default(10),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      session_id: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, duration_ms, created_at, metadata, error_message')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (args.session_id) {
      query = query.eq('id', args.session_id);
    } else {
      query = query.in('tool_name', [
        'run_cognitive_loop',
        'orchestrate_task',
        'trigger_bonnie_dream',
        'supervise_task',
      ]);
    }

    const { data, error } = await query;
    if (error) throwConnectorError('QUERY_FAILED', error.message);

    return {
      traces: (data || []).map((row: any) => ({
        id: row.id,
        tool: row.tool_name,
        success: row.success,
        duration_ms: row.duration_ms,
        created_at: row.created_at,
        reasoning: row.metadata?.reasoning || row.metadata?.trace || row.metadata || null,
        error: row.error_message,
      })),
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_memory',
  description: 'Inspect Bonnie Nexus / business memory entries for the tenant.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(100).optional().default(25),
    key: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number' },
      key: { type: 'string' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from('nexus_memory')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .order('updated_at', { ascending: false })
      .limit(args.limit);
    if (args.key) query = query.eq('key', args.key);
    const { data, error } = await query;
    if (error?.code === '42P01') {
      const { data: twin } = await supabase
        .from('business_digital_twins')
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .order('updated_at', { ascending: false })
        .limit(1);
      return { memory: [], digital_twin: twin?.[0] || null, note: 'nexus_memory table unavailable; returned digital twin fallback' };
    }
    if (error) throwConnectorError('QUERY_FAILED', error.message);
    return { memory: data || [] };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_tools',
  description: 'Inspect the full MCP tool catalog Bonnie/ChatGPT can discover and execute.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    module_filter: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      module_filter: { type: 'string', description: 'Optional substring filter on tool name' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const tools = await getUnifiedMcpTools({ sanitizeForClient: true });
    const filtered = args.module_filter
      ? tools.filter((t) => t.name.includes(args.module_filter!))
      : tools;
    return {
      total: filtered.length,
      tools: filtered.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_prompts',
  description: 'Inspect Bonnie system prompts, skill prompts, and MCP prompt templates.',
  permission: 'bonnie:read',
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
    const agents = listRegisteredAgents().map((a) => ({
      id: a.id,
      name: a.name,
      department: a.department,
      tools: a.tools,
    }));

    const { data: skills } = await supabase
      .from('bonnie_skills')
      .select('id, name, description, prompt, enabled')
      .eq('tenant_id', args.tenant_id)
      .limit(100);

    return {
      department_agents: agents,
      skills: skills || [],
      mcp_prompts: ['review_bonnie_patterns'],
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_vector_store',
  description: 'Inspect vector store collections used by Bonnie RAG for this tenant.',
  permission: 'bonnie:read',
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
    const collections: Array<{ name: string; count: number | null; error?: string }> = [];

    for (const table of ['document_embeddings', 'knowledge_embeddings', 'rag_chunks', 'vector_documents']) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', args.tenant_id);
      if (error?.code === '42P01') continue;
      collections.push({ name: table, count: count ?? 0, error: error?.message });
    }

    return {
      collections,
      status: collections.length ? 'available' : 'no_vector_tables_found',
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_embeddings',
  description: 'Sample recent embeddings / chunk metadata for Bonnie RAG diagnostics.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(50).optional().default(10),
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
    for (const table of ['document_embeddings', 'rag_chunks', 'knowledge_embeddings']) {
      const { data, error } = await supabase
        .from(table)
        .select('id, document_id, source, created_at, metadata')
        .eq('tenant_id', args.tenant_id)
        .order('created_at', { ascending: false })
        .limit(args.limit);
      if (!error) {
        return { table, embeddings: (data || []).map((row: any) => ({ ...row, embedding: undefined })) };
      }
    }
    return { table: null, embeddings: [], note: 'No embedding tables available for tenant' };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_rag',
  description: 'Inspect RAG pipeline status: document corpus, chunk counts, and recent retrievals.',
  permission: 'bonnie:read',
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
    const { count: docCount } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', args.tenant_id);

    const { count: fileCount } = await supabase
      .from('files')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', args.tenant_id);

    return {
      documents: docCount ?? 0,
      files: fileCount ?? 0,
      rag_enabled: true,
      retrieval_backend: 'supabase',
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_planner',
  description: 'Inspect Bonnie planner / supervisor decisions and recent plans.',
  permission: 'bonnie:read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    limit: z.number().int().min(1).max(50).optional().default(10),
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
    const agents = listRegisteredAgents();
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, created_at, metadata, success')
      .eq('tenant_id', args.tenant_id)
      .in('tool_name', ['supervise_task', 'orchestrate_task', 'run_cognitive_loop'])
      .order('created_at', { ascending: false })
      .limit(args.limit);

    return {
      available_agents: agents.map((a) => ({ id: a.id, name: a.name, department: a.department })),
      recent_plans: data || [],
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_executor',
  description: 'Inspect Bonnie executor status: pending approvals, recent executions, risk policy.',
  permission: 'bonnie:read',
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
    const { data: approvals } = await supabase
      .from('bonnie_approvals')
      .select('id, tool_name, status, created_at, risk_class')
      .eq('tenant_id', args.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: recent } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, created_at, duration_ms')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      pending_approvals: approvals || [],
      recent_executions: recent || [],
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_scheduler',
  description: 'Inspect scheduled Bonnie/cron work: scheduled AI tasks, social publish, campaigns.',
  permission: 'bonnie:read',
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
    const { data: scheduledAi } = await supabase
      .from('scheduled_ai_tasks')
      .select('id, task_type, status, run_at, created_at')
      .eq('tenant_id', args.tenant_id)
      .order('run_at', { ascending: true })
      .limit(50);

    const { data: social } = await supabase
      .from('social_posts')
      .select(
        'id, status, scheduled_at, platforms, platform, facebook_page_id, linkedin_organization_id, linkedin_post_urn, published_at, error_message'
      )
      .eq('tenant_id', args.tenant_id)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(50);

    const now = Date.now();
    const overdue = (social || []).filter((p) => {
      if (!p.scheduled_at) return false;
      return new Date(p.scheduled_at).getTime() <= now - 5 * 60 * 1000;
    });

    return {
      scheduled_ai_tasks: scheduledAi || [],
      scheduled_social_posts: social || [],
      overdue_social_posts: overdue,
      source_of_truth: 'social_posts',
      note: 'scheduled_posts tool and inspect_scheduler both read social_posts where status=scheduled',
    };
  },
});

defineConnectorTool({
  module: 'bonnie-inspect',
  name: 'inspect_task_queue',
  description: 'Inspect background job / task queues used by Bonnie and platform workers.',
  permission: 'bonnie:read',
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
    const queues: Record<string, unknown> = {};

    for (const table of ['background_jobs', 'job_queue', 'mcp_event_queue', 'tasks']) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('tenant_id', args.tenant_id)
        .order('created_at', { ascending: false })
        .limit(args.limit);
      if (!error) queues[table] = data || [];
    }

    return { queues };
  },
});
