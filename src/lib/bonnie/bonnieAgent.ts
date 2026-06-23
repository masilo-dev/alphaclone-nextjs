import { callDeepSeek, chatDeepSeek } from '@/lib/ai/deepseek';
import { routeAIRequest } from '@/services/aiRouter';
import { buildBonnieSystemPrompt } from '@/lib/bonnie/bonnieSystemPrompt';
import { resolveBonnieModuleFromPath, type BonnieModuleId } from '@/lib/bonnie/bonnieToolCatalog';
import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import {
  executeBonnieToolCalls,
  type BonnieToolCall,
  type BonnieToolResult,
} from '@/lib/bonnie/bonnieToolExecutor';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieAgentInput = {
  tenantId: string;
  userId: string;
  instruction: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  moduleContext?: BonnieModuleId;
  pathname?: string;
};

export type BonnieAgentResult = {
  response: string;
  success: boolean;
  provider: string;
  model: string;
  toolResults: BonnieToolResult[];
  logs: string[];
};

type BonniePlan = {
  response: string;
  tool_calls?: BonnieToolCall[];
  logs?: string[];
};

function parseJsonPlan(raw: string): BonniePlan {
  let jsonText = raw.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start >= 0 && end > start) {
    jsonText = jsonText.slice(start, end + 1);
  }
  return JSON.parse(jsonText) as BonniePlan;
}

async function planWithDeepSeek(
  instruction: string,
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>,
  history: BonnieAgentInput['history'],
  moduleId: BonnieModuleId
): Promise<{ plan: BonniePlan; model: string }> {
  const systemPrompt = buildBonnieSystemPrompt(moduleId);
  const userBlock = `WORKSPACE SNAPSHOT (live):
${JSON.stringify(snapshot, null, 2)}

USER INSTRUCTION:
${instruction}

Plan the response and any tool_calls needed. Remember: you are Bonnie AI for AlphaClone.`;

  if (process.env.DEEPSEEK_API_KEY) {
    const model = 'deepseek-reasoner';
    const raw = history?.length
      ? await chatDeepSeek(history, userBlock, {
          systemPrompt,
          model,
          maxTokens: 4096,
          temperature: 0.35,
        })
      : await callDeepSeek(userBlock, {
          systemPrompt,
          model,
          maxTokens: 4096,
          temperature: 0.35,
        });
    return { plan: parseJsonPlan(raw), model };
  }

  const fallback = await routeAIRequest({
    prompt: userBlock,
    systemPrompt: buildBonnieSystemPrompt(moduleId),
    maxTokens: 4096,
    model: 'deepseek-reasoner',
    temperature: 0.35,
  });

  return { plan: parseJsonPlan(fallback.content), model: fallback.model };
}

async function synthesizeWithDeepSeek(
  instruction: string,
  plan: BonniePlan,
  toolResults: BonnieToolResult[],
  moduleId: BonnieModuleId
): Promise<string | null> {
  if (!toolResults.length) return plan.response;

  const synthesisPrompt = `You are Bonnie AI. The user asked: "${instruction}"

Your draft response was: ${plan.response}

Tool execution results:
${JSON.stringify(toolResults, null, 2)}

Write a final concise user-facing reply as Bonnie — summarize what was done and key findings. No vendor names. Plain text only, no JSON.`;

  if (process.env.DEEPSEEK_API_KEY) {
    return callDeepSeek(synthesisPrompt, {
      model: 'deepseek-chat',
      maxTokens: 1200,
      temperature: 0.4,
      systemPrompt: buildBonnieSystemPrompt(moduleId),
    });
  }

  const res = await routeAIRequest({
    prompt: synthesisPrompt,
    systemPrompt: buildBonnieSystemPrompt(moduleId),
    maxTokens: 1200,
  });
  return res.content;
}

async function persistBonnieLogs(tenantId: string, logs: string[]) {
  if (!logs.length) return;
  const admin = createSupabaseAdminClient();
  const rows = logs.map((message) => ({
    tenant_id: tenantId,
    level: 'info',
    message,
  }));
  try {
    await admin.from('bonnie_logs').insert(rows);
  } catch {
    // optional table
  }
}

async function persistRunnerActions(
  tenantId: string,
  instruction: string,
  toolResults: BonnieToolResult[]
) {
  const executed = toolResults.filter((r) => r.success);
  if (!executed.length) return;

  const admin = createSupabaseAdminClient();
  const { data: runData } = await admin
    .from('autonomous_runner_runs')
    .insert({
      tenant_id: tenantId,
      status: 'completed',
      trigger_snapshot: { source: 'bonnie_chat', instruction },
      summary: { actions_run: executed.length },
    })
    .select('id')
    .single();

  if (!runData?.id) return;

  await admin.from('autonomous_runner_actions').insert(
    executed.map((r) => ({
      run_id: runData.id,
      tenant_id: tenantId,
      action_key: r.tool,
      status: 'success',
      details: r.summary,
      payload: { instruction, details: r.details?.slice(0, 500) },
    }))
  );
}

export async function runBonnieAgent(input: BonnieAgentInput): Promise<BonnieAgentResult> {
  const { tenantId, userId, instruction, history = [], pathname, moduleContext } = input;
  const moduleId = moduleContext || resolveBonnieModuleFromPath(pathname || '');
  const snapshot = await getBonnieWorkspaceSnapshot(tenantId);

  let plan: BonniePlan;
  let model = 'deepseek-reasoner';
  let provider = process.env.DEEPSEEK_API_KEY ? 'bonnie-deepseek' : 'fallback';

  try {
    const planned = await planWithDeepSeek(instruction, snapshot, history, moduleId);
    plan = planned.plan;
    model = planned.model;
  } catch (err: any) {
    return {
      response: `Bonnie could not parse that request (${err.message}). Try rephrasing with a clear action, e.g. "run autonomous scan" or "show overdue invoices".`,
      success: false,
      provider,
      model,
      toolResults: [],
      logs: [],
    };
  }

  const toolCalls = plan.tool_calls || [];
  const toolResults = toolCalls.length
    ? await executeBonnieToolCalls(tenantId, userId, toolCalls)
    : [];

  let response = plan.response || 'Done.';
  if (toolResults.length) {
    const synthesized = await synthesizeWithDeepSeek(instruction, plan, toolResults, moduleId).catch(() => null);
    if (synthesized?.trim()) response = synthesized.trim();
  }

  const logs = [
    ...(plan.logs || []),
    ...toolResults.map((r) => `${r.success ? '✓' : '✗'} ${r.tool}: ${r.summary}`),
  ];

  await persistBonnieLogs(tenantId, logs);
  await persistRunnerActions(tenantId, instruction, toolResults);

  return {
    response,
    success: true,
    provider,
    model,
    toolResults,
    logs,
  };
}
