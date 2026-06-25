// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { callDeepSeek } from '@/lib/ai/deepseek';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';

const READ_ONLY_TOOLS = new Set([
  'get_contacts', 'get_deals', 'get_leads', 'get_invoices', 'get_tasks', 'get_tickets',
  'get_clients', 'search_clients', 'get_business_snapshot', 'accounting_snapshot',
  'get_pipeline_summary', 'summarize_workspace', 'campaign_diagnose', 'get_automation_health',
  'solo_owner_operator_brief', 'recommend_next_steps', 'list_skills', 'load_skill',
]);

const SubagentSchema = z.object({
  name: z.string(),
  role: z.string(),
  instructions: z.string(),
  tools: z.array(z.string()).optional(),
});

async function runSubagentWithTools(params: {
  tenantId: string;
  userId: string;
  task: string;
  subagent: z.infer<typeof SubagentSchema>;
}): Promise<{ name: string; role: string; result: string; success: boolean; toolResults: unknown[] }> {
  const allowedTools = (params.subagent.tools || []).filter((t) => READ_ONLY_TOOLS.has(t));
  const toolList = allowedTools.length ? allowedTools : ['summarize_workspace', 'get_business_snapshot'];

  const planRaw = await callDeepSeek(
    `Main task: ${params.task}\nSubagent role: ${params.subagent.role}\nInstructions: ${params.subagent.instructions}\n\nReturn JSON only: { "response": "...", "tool_calls": [{ "tool": "name", "arguments": {} }] }`,
    {
      model: 'deepseek-chat',
      maxTokens: 1200,
      temperature: 0.35,
      systemPrompt: `You are ${params.subagent.name}, a Bonnie AI sub-agent (${params.subagent.role}). You may ONLY use these read-only tools: ${toolList.join(', ')}. Max 3 tool calls.`,
    }
  );

  let plan: { response?: string; tool_calls?: Array<{ tool: string; arguments?: Record<string, unknown> }> } = {};
  try {
    const jsonText = planRaw.includes('{') ? planRaw.slice(planRaw.indexOf('{'), planRaw.lastIndexOf('}') + 1) : '{}';
    plan = JSON.parse(jsonText);
  } catch {
    return { name: params.subagent.name, role: params.subagent.role, result: planRaw, success: true, toolResults: [] };
  }

  const toolResults: unknown[] = [];
  for (const call of (plan.tool_calls || []).slice(0, 3)) {
    if (!READ_ONLY_TOOLS.has(call.tool)) continue;
    const tr = await executeSingleBonnieTool({
      tenantId: params.tenantId,
      userId: params.userId,
      tool: call.tool,
      args: call.arguments || {},
    });
    toolResults.push(tr);
  }

  const synthesis = toolResults.length
    ? await callDeepSeek(
        `Task: ${params.task}\nSubagent: ${params.subagent.name}\nDraft: ${plan.response || ''}\nTool results: ${JSON.stringify(toolResults)}\n\nWrite a brief JSON summary: { "outcome", "details", "next_steps" }`,
        { model: 'deepseek-chat', maxTokens: 800, temperature: 0.4 }
      )
    : plan.response || planRaw;

  return {
    name: params.subagent.name,
    role: params.subagent.role,
    result: synthesis,
    success: true,
    toolResults,
  };
}

registerTool('bonnie-orchestrate', {
  name: 'orchestrate_task',
  description:
    'Orchestrates a complex task by delegating sub-tasks to specialized Bonnie AI sub-agents with read-only tool access.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    task: z.string().min(1),
    subagents: z.array(SubagentSchema).min(1).max(5),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      user_id: { type: 'string', description: 'User UUID' },
      task: { type: 'string', description: 'High-level task to orchestrate' },
      subagents: {
        type: 'array',
        description: 'List of subagents to delegate to (max 5)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
            instructions: { type: 'string' },
            tools: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'role', 'instructions'],
        },
      },
    },
    required: ['tenant_id', 'task', 'subagents'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const userId = args.user_id || ctx.userId;
    const subagentResults = [];

    for (const subagent of args.subagents) {
      try {
        subagentResults.push(
          await runSubagentWithTools({
            tenantId: args.tenant_id,
            userId,
            task: args.task,
            subagent,
          })
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Subagent failed';
        subagentResults.push({ name: subagent.name, role: subagent.role, result: message, success: false, toolResults: [] });
      }
    }

    try {
      await supabase.from('mcp_sessions').insert({
        tenant_id: args.tenant_id,
        user_id: userId || null,
        tool_name: 'orchestrate_task',
        success: subagentResults.every((r) => r.success),
        duration_ms: 0,
        tool_success: subagentResults.every((r) => r.success),
        tool_latency_ms: 0,
        expires_at: new Date(Date.now() + 60000).toISOString(),
      });
    } catch (_) { /* non-critical */ }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          task: args.task,
          total_subagents: args.subagents.length,
          results: subagentResults,
          orchestration_complete: true,
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-orchestrate', {
  name: 'get_orchestration_history',
  description: 'Returns the history of orchestrated tasks for a tenant from the mcp_sessions log.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      limit: { type: 'number', description: 'Max number of history entries (default 20)', default: 20 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('mcp_sessions')
      .select('id, tool_name, success, duration_ms, created_at')
      .eq('tenant_id', args.tenant_id)
      .eq('tool_name', 'orchestrate_task')
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw new Error(`Failed to fetch orchestration history: ${error.message}`);

    return {
      content: [{ type: 'text', text: JSON.stringify({ history: data || [] }, null, 2) }],
    };
  },
});
