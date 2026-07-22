// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { callDeepSeek } from '@/lib/ai/deepseek';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { recordDecision } from '@/services/nexusDecisionLogService';

const DEFAULT_READ_TOOLS = new Set([
  'get_contacts', 'get_deals', 'get_leads', 'get_invoices', 'get_tasks', 'get_tickets',
  'get_clients', 'search_clients', 'get_business_snapshot', 'accounting_snapshot',
  'get_pipeline_summary', 'summarize_workspace', 'campaign_diagnose', 'get_automation_health',
  'solo_owner_operator_brief', 'recommend_next_steps', 'list_skills', 'load_skill',
  'get_revenue_summary', 'get_accounts_receivable_aging', 'get_linkedin_posts',
  'get_scheduled_posts', 'get_project_details', 'trust_ledger',
  'qualify_crm_leads', 'get_scraper_leads', 'find_and_qualify_leads',
]);

import { selectAgentsForGoal } from '@/lib/bonnie/os/supervisor';
import { toOrchestratorSubagents } from '@/lib/bonnie/os/agentRegistry';

/** @deprecated Prefer DEPARTMENT_AGENTS via Supervisor — kept for backward compatibility */
export const SPECIALIST_SUBAGENTS = [
  {
    name: 'CRM Specialist',
    role: 'crm_analyst',
    instructions: 'Audit contacts, leads, deals pipeline health. Flag stale deals and missing follow-ups.',
    tools: ['get_contacts', 'get_leads', 'get_deals', 'get_pipeline_summary', 'recommend_next_steps'],
  },
  {
    name: 'Finance Specialist',
    role: 'finance_analyst',
    instructions: 'Review revenue, overdue invoices, AR aging, and cash collection risks.',
    tools: ['get_invoices', 'accounting_snapshot', 'get_revenue_summary', 'get_accounts_receivable_aging'],
  },
  {
    name: 'Leads Specialist',
    role: 'leads_analyst',
    instructions: 'Assess lead pipeline quality, scraper inventory, and qualification opportunities.',
    tools: ['get_leads', 'qualify_crm_leads', 'get_scraper_leads', 'find_and_qualify_leads'],
  },
] as const;

function mergeSubagents(
  userSubagents: Array<{ name: string; role: string; instructions: string; tools?: string[]; write_allowed?: boolean }>,
  useSpecialists: boolean,
  task?: string
) {
  if (!useSpecialists || userSubagents.length > 0) return userSubagents;
  // Supervisor selects best department agents for this task (falls back to classic trio)
  try {
    const selected = selectAgentsForGoal(task || 'audit business health', { maxAgents: 4 });
    if (selected.length) return toOrchestratorSubagents(selected);
  } catch {
    // fall through
  }
  return SPECIALIST_SUBAGENTS.map((s) => ({ ...s, tools: [...s.tools] }));
}

const SubagentSchema = z.object({
  name: z.string(),
  role: z.string(),
  instructions: z.string(),
  tools: z.array(z.string()).optional(),
  write_allowed: z.boolean().optional().default(false),
});

async function runSubagentWithTools(params: {
  tenantId: string;
  userId: string;
  task: string;
  subagent: z.infer<typeof SubagentSchema>;
}): Promise<{ name: string; role: string; result: string; success: boolean; toolResults: unknown[] }> {
  const writeAllowed = params.subagent.write_allowed === true;
  const requestedTools = params.subagent.tools || [];
  const allowedTools = requestedTools.length
    ? requestedTools.filter((t) => writeAllowed || DEFAULT_READ_TOOLS.has(t))
    : ['summarize_workspace', 'get_business_snapshot'];

  const planRaw = await callDeepSeek(
    `Main task: ${params.task}\nSubagent role: ${params.subagent.role}\nInstructions: ${params.subagent.instructions}\n\nReturn JSON only: { "response": "...", "tool_calls": [{ "tool": "name", "arguments": {} }] }`,
    {
      model: 'deepseek-chat',
      maxTokens: 1200,
      temperature: 0.35,
      systemPrompt: `You are ${params.subagent.name}, a Bonnie AI sub-agent (${params.subagent.role}). Allowed tools: ${allowedTools.join(', ')}. Max 3 tool calls.${writeAllowed ? ' You may use write tools in your allowed list.' : ' Read-only tools only.'}`,
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
    if (!writeAllowed && !DEFAULT_READ_TOOLS.has(call.tool)) continue;
    if (writeAllowed && requestedTools.length && !requestedTools.includes(call.tool)) continue;

    const tr = await executeSingleBonnieTool({
      tenantId: params.tenantId,
      userId: params.userId,
      tool: call.tool,
      args: call.arguments || {},
      instruction: params.task,
    });
    toolResults.push(tr);
  }

  const synthesis = toolResults.length
    ? await callDeepSeek(
        `Task: ${params.task}\nSubagent: ${params.subagent.name}\nDraft: ${plan.response || ''}\nTool results: ${JSON.stringify(toolResults)}\n\nWrite a brief JSON summary: { "outcome", "details", "next_steps" }`,
        { model: 'deepseek-chat', maxTokens: 800, temperature: 0.4 }
      )
    : plan.response || planRaw;

  await recordDecision({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: params.task,
    toolName: 'orchestrate_subagent',
    toolArgs: { subagent: params.subagent.name, role: params.subagent.role },
    outcome: 'executed',
    reasoning: `Subagent ${params.subagent.name} synthesis complete`,
  });

  return {
    name: params.subagent.name,
    role: params.subagent.role,
    result: synthesis,
    success: true,
    toolResults,
  };
}

async function planOrchestratorActions(params: {
  task: string;
  subagentResults: unknown[];
}): Promise<Array<{ tool: string; arguments: Record<string, unknown>; risk_class?: string }>> {
  const planRaw = await callDeepSeek(
    `Main task: ${params.task}\nSubagent intelligence:\n${JSON.stringify(params.subagentResults, null, 2)}\n\nReturn JSON only: { "actions": [{ "tool": "name", "arguments": {}, "risk_class": "read|draft|send|financial" }] }\nMax 5 actions. Prioritize highest business impact.`,
    {
      model: 'deepseek-chat',
      maxTokens: 1400,
      temperature: 0.35,
      systemPrompt: 'You are Bonnie orchestrator. Convert subagent intelligence into concrete MCP tool actions.',
    }
  );

  try {
    const jsonText = planRaw.includes('{') ? planRaw.slice(planRaw.indexOf('{'), planRaw.lastIndexOf('}') + 1) : '{}';
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [];
  } catch {
    return [];
  }
}

registerTool('bonnie-orchestrate', {
  name: 'orchestrate_task',
  description:
    'Orchestrates a complex task: parallel sub-agents gather intelligence, orchestrator plans and executes actions with policy gating.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    task: z.string().min(1),
    subagents: z.array(SubagentSchema).max(5).optional(),
    use_specialist_subagents: z.boolean().optional().default(true),
    execute_actions: z.boolean().optional().default(true),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      user_id: { type: 'string', description: 'User UUID' },
      task: { type: 'string', description: 'High-level task to orchestrate' },
      execute_actions: { type: 'boolean', description: 'Execute planned actions after gather phase', default: true },
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
            write_allowed: { type: 'boolean' },
          },
          required: ['name', 'role', 'instructions'],
        },
      },
    },
    required: ['tenant_id', 'task'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const userId = ctx.userId || args.user_id;

    const { data: runRow, error: runInsertError } = await supabase
      .from('nexus_orchestration_runs')
      .insert({
        tenant_id: args.tenant_id,
        user_id: userId || null,
        task: args.task,
        status: 'running',
      })
      .select('id')
      .single();

    if (runInsertError) throw new Error(`Failed to create orchestration run: ${runInsertError.message}`);
    const runId = runRow.id;

    const subagents = mergeSubagents(args.subagents || [], args.use_specialist_subagents !== false, args.task);
    if (!subagents.length) {
      throw new Error('At least one subagent is required (or enable use_specialist_subagents).');
    }

    const subagentResults = await Promise.all(
      subagents.map(async (subagent) => {
        try {
          return await runSubagentWithTools({
            tenantId: args.tenant_id,
            userId,
            task: args.task,
            subagent,
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Subagent failed';
          return { name: subagent.name, role: subagent.role, result: message, success: false, toolResults: [] };
        }
      })
    );

    const plannedActions = await planOrchestratorActions({
      task: args.task,
      subagentResults,
    });

    await recordDecision({
      tenantId: args.tenant_id,
      userId,
      instruction: args.task,
      toolName: 'orchestrate_plan',
      toolArgs: { run_id: runId, actions: plannedActions },
      outcome: 'executed',
      reasoning: `Orchestrator planned ${plannedActions.length} actions`,
    });

    const executionResults: unknown[] = [];
    if (args.execute_actions !== false) {
      for (const action of plannedActions) {
        if (!action?.tool) continue;
        const result = await executeSingleBonnieTool({
          tenantId: args.tenant_id,
          userId,
          tool: action.tool,
          args: action.arguments || {},
          instruction: args.task,
        });
        executionResults.push(result);
        if (result.approvalRequired) break;
      }
    }

    const allSubagentsOk = subagentResults.every((r) => r.success);
    const execOk = executionResults.every((r: { success?: boolean }) => r?.success !== false);
    const status =
      !allSubagentsOk ? 'partial' : executionResults.length && !execOk ? 'partial' : 'completed';

    await supabase
      .from('nexus_orchestration_runs')
      .update({
        subagent_results: subagentResults,
        planned_actions: plannedActions,
        execution_results: executionResults,
        status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          run_id: runId,
          task: args.task,
          total_subagents: subagents.length,
          subagent_results: subagentResults,
          planned_actions: plannedActions,
          execution_results: executionResults,
          orchestration_complete: true,
          status,
        }, null, 2),
      }],
    };
  },
});

registerTool('bonnie-orchestrate', {
  name: 'get_orchestration_history',
  description: 'Returns orchestration run history for a tenant from nexus_orchestration_runs.',
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
      .from('nexus_orchestration_runs')
      .select('id, task, status, subagent_results, planned_actions, execution_results, created_at, completed_at')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw new Error(`Failed to fetch orchestration history: ${error.message}`);

    return {
      content: [{ type: 'text', text: JSON.stringify({ history: data || [] }, null, 2) }],
    };
  },
});
