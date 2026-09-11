/**
 * Executes a single outcome graph step via MCP tools (used by Bonnie worker).
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeTool } from '@/lib/mcp/tool-registry';

export function parseToolResultContent(content: unknown): {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
} {
  try {
    const blocks = Array.isArray(content) ? content : [];
    const text = (blocks as Array<{ type?: string; text?: string }>).find((b) => b?.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.ok === false) {
      const err = parsed.error;
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : typeof err === 'string'
            ? err
            : 'tool_failed';
      return { ok: false, error: message, data: parsed };
    }
    return { ok: true, data: (parsed.data as Record<string, unknown>) || parsed };
  } catch {
    return { ok: false, error: 'invalid_tool_response' };
  }
}

async function loadPriorStepOutputs(runId: string, tenantId: string): Promise<Record<string, unknown>> {
  const admin = createSupabaseAdminClient();
  const { data: tasks } = await admin
    .from('agent_tasks')
    .select('structured_input, structured_output, status')
    .eq('run_id', runId)
    .eq('tenant_id', tenantId)
    .eq('task_type', 'outcome.execute_step')
    .eq('status', 'COMPLETED');

  const prior: Record<string, unknown> = {};
  for (const row of tasks || []) {
    const stepId = (row.structured_input as Record<string, unknown> | null)?.step_id;
    if (typeof stepId === 'string' && row.structured_output) {
      prior[stepId] = row.structured_output;
    }
  }
  return prior;
}

export async function executeOutcomeStepTask(params: {
  tenantId: string;
  userId: string;
  task: Record<string, unknown>;
}): Promise<{ ok: boolean; output?: Record<string, unknown>; error?: string }> {
  const input = (params.task.structured_input || {}) as Record<string, unknown>;
  const tool = String(input.tool || '');
  const args = { ...((input.args || {}) as Record<string, unknown>) };
  if (!tool) return { ok: false, error: 'missing_tool' };

  args.tenant_id = args.tenant_id || params.tenantId;
  if (tool === 'create_meeting' && !args.host_id) {
    args.host_id = params.userId;
  }

  const runId = String(params.task.run_id || '');
  const priorOutputs = runId ? await loadPriorStepOutputs(runId, params.tenantId) : {};
  const bindFromPrior = (input.bind_from_prior || {}) as Record<string, string>;
  for (const [argKey, priorPath] of Object.entries(bindFromPrior)) {
    const [stepId, field] = priorPath.split('.');
    const stepOut = priorOutputs[stepId];
    if (stepOut && typeof stepOut === 'object' && field in (stepOut as object)) {
      args[argKey] = (stepOut as Record<string, unknown>)[field];
    }
  }

  const result = await executeTool(params.tenantId, params.userId, tool, args);
  const parsed = parseToolResultContent(result.content);
  if (result.isError || !parsed.ok) {
    return { ok: false, error: parsed.error || 'tool_execution_failed', output: parsed.data };
  }

  const stepId = String(input.step_id || 'step');
  return {
    ok: true,
    output: {
      step_id: stepId,
      tool,
      ...(parsed.data || {}),
    },
  };
}
