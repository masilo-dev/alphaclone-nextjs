import { callDeepSeek, chatDeepSeek, streamDeepSeek } from '@/lib/ai/deepseek';
import { routeAIRequest, cleanProfessionalContent } from '@/services/aiRouter';
import { buildBonnieSystemPrompt } from '@/lib/bonnie/bonnieSystemPrompt';
import { buildBonnieConversationalPrompt } from '@/lib/bonnie/bonnieConversationalPrompt';
import {
  BONNIE_MODULE_HINTS,
  resolveBonnieModuleFromPath,
  type BonnieModuleId,
} from '@/lib/bonnie/bonnieToolCatalog';
import { getBonnieWorkspaceSnapshot } from '@/lib/bonnie/bonnieWorkspaceSnapshot';
import type { BonnieToolCall, BonnieToolResult } from '@/lib/bonnie/bonnieToolExecutor';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type BonnieAgentInput = {
  tenantId: string;
  userId: string;
  instruction: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  moduleContext?: BonnieModuleId;
  pathname?: string;
  onStreamToken?: (token: string) => void;
};

export type BonnieAgentResult = {
  response: string;
  success: boolean;
  provider: string;
  model: string;
  toolResults: BonnieToolResult[];
  logs: string[];
  rounds: number;
};

type BonniePlan = {
  response: string;
  tool_calls?: BonnieToolCall[];
  logs?: string[];
  done?: boolean;
};

const MAX_AGENT_ROUNDS = 4;

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

function looksLikeActionRequest(text: string): boolean {
  return /\b(send|create|run|publish|draft|compose|find|search|audit|update|delete|schedule|post|invoice|reach out|follow up|open|show me|list|get|sync|enable|disable|queue|launch|execute|do|make|write|generate)\b/i.test(
    text
  );
}

async function conversationalReply(
  instruction: string,
  history: BonnieAgentInput['history'],
  moduleId: BonnieModuleId,
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>,
  onStreamToken?: (token: string) => void
): Promise<{ text: string; model: string }> {
  const systemPrompt = buildBonnieConversationalPrompt(moduleId);
  const contextBlock = `Workspace snapshot (live counts):\n${JSON.stringify(snapshot.counts || snapshot, null, 2)}\n\nUser:\n${instruction}`;

  if (process.env.DEEPSEEK_API_KEY) {
    const model = 'deepseek-chat';
    if (onStreamToken) {
      const text = history?.length
        ? await streamDeepSeek(history, contextBlock, { systemPrompt, model, maxTokens: 1800, temperature: 0.55 }, onStreamToken)
        : await streamDeepSeek([], contextBlock, { systemPrompt, model, maxTokens: 1800, temperature: 0.55 }, onStreamToken);
      return { text: text.trim(), model };
    }
    const text = history?.length
      ? await chatDeepSeek(history, contextBlock, {
          systemPrompt,
          model,
          maxTokens: 1800,
          temperature: 0.55,
        })
      : await callDeepSeek(contextBlock, {
          systemPrompt,
          model,
          maxTokens: 1800,
          temperature: 0.55,
        });
    return { text: text.trim(), model };
  }

  const fallback = await routeAIRequest({
    prompt: contextBlock,
    systemPrompt,
    maxTokens: 1800,
    temperature: 0.55,
  });
  return { text: fallback.content.trim(), model: fallback.model };
}

async function planWithDeepSeek(
  instruction: string,
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>,
  history: BonnieAgentInput['history'],
  moduleId: BonnieModuleId,
  priorToolResults: BonnieToolResult[],
  round: number
): Promise<{ plan: BonniePlan; model: string }> {
  const systemPrompt = buildBonnieSystemPrompt(moduleId);
  const priorBlock =
    priorToolResults.length > 0
      ? `\n\nPRIOR TOOL RESULTS (round ${round}):\n${JSON.stringify(
          priorToolResults.map((r) => ({
            tool: r.tool,
            success: r.success,
            summary: r.summary,
          })),
          null,
          2
        )}\nIf the task is complete, set "done": true and return empty tool_calls with your final response. Otherwise continue with the next tool_calls needed.`
      : '';

  const userBlock = `WORKSPACE SNAPSHOT (live):
${JSON.stringify(snapshot, null, 2)}

USER INSTRUCTION:
${instruction}${priorBlock}

Plan like DeepCode: break work into steps, run tools, iterate until done. Round ${round + 1} of ${MAX_AGENT_ROUNDS}.`;

  if (process.env.DEEPSEEK_API_KEY) {
    const model = 'deepseek-chat';
    const raw = history?.length && round === 0
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
    systemPrompt,
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
  moduleId: BonnieModuleId,
  onStreamToken?: (token: string) => void
): Promise<string | null> {
  if (!toolResults.length) return cleanProfessionalContent(plan.response);

  // Sanitize tool summaries before adding to prompt
  const sanitizeSummary = (text: string) => text
    .replace(/[*]{2,}/g, '')
    .replace(/[£]{2,}/g, '')
    .replace(/[$]{2,}/g, '')
    .replace(/[#]{2,}/g, '')
    .slice(0, 200);

  const synthesisPrompt = `You are Bonnie AI (in-platform agent — DeepChat/DeepCode style, Bonnie-branded).

The user asked: "${instruction}"

Your draft: ${plan.response}

Tools executed:
${toolResults.map((r) => `- ${r.success ? '✓' : '✗'} ${r.tool}: ${sanitizeSummary(r.summary)}`).join('\n')}

Write the final reply: what you did, key results, and clear next step if any. Plain text, concise, professional. No vendor names.`;

  if (process.env.DEEPSEEK_API_KEY) {
    if (onStreamToken) {
      // For streaming, we need to clean tokens as they come through
      const wrappedOnStreamToken = (token: string) => {
        onStreamToken(cleanProfessionalContent(token));
      };
      const result = await streamDeepSeek([], synthesisPrompt, {
        model: 'deepseek-chat',
        maxTokens: 1400,
        temperature: 0.45,
        systemPrompt: buildBonnieConversationalPrompt(moduleId),
      }, wrappedOnStreamToken);
      return result ? cleanProfessionalContent(result) : null;
    }
    const result = await callDeepSeek(synthesisPrompt, {
      model: 'deepseek-chat',
      maxTokens: 1400,
      temperature: 0.45,
      systemPrompt: buildBonnieConversationalPrompt(moduleId),
    });
    return cleanProfessionalContent(result);
  }

  const res = await routeAIRequest({
    prompt: synthesisPrompt,
    systemPrompt: buildBonnieConversationalPrompt(moduleId),
    maxTokens: 1400,
  });
  return cleanProfessionalContent(res.content);
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

function resolveModuleId(
  moduleContext?: BonnieModuleId,
  pathname?: string
): BonnieModuleId {
  if (moduleContext && moduleContext in BONNIE_MODULE_HINTS) {
    return moduleContext;
  }
  return resolveBonnieModuleFromPath(pathname || '');
}

export async function runBonnieAgent(input: BonnieAgentInput): Promise<BonnieAgentResult> {
  const { tenantId, userId, instruction, history = [], pathname, moduleContext, onStreamToken } = input;
  const moduleId = resolveModuleId(moduleContext, pathname);
  const snapshot = await getBonnieWorkspaceSnapshot(tenantId);

  let model = 'deepseek-chat';
  const provider = process.env.DEEPSEEK_API_KEY ? 'bonnie-deepseek' : 'fallback';

  // Pure Q&A — conversational DeepChat mode without tool JSON
  if (!looksLikeActionRequest(instruction)) {
    try {
      const { text, model: chatModel } = await conversationalReply(instruction, history, moduleId, snapshot, onStreamToken);
      return {
        response: text,
        success: true,
        provider,
        model: chatModel,
        toolResults: [],
        logs: ['Conversational reply (no tools)'],
        rounds: 0,
      };
    } catch (err: any) {
      return {
        response: `Bonnie could not answer that (${err.message}). Try rephrasing.`,
        success: false,
        provider,
        model,
        toolResults: [],
        logs: [],
        rounds: 0,
      };
    }
  }

  const allToolResults: BonnieToolResult[] = [];
  const allLogs: string[] = [];
  let lastPlan: BonniePlan = { response: 'Done.' };
  let rounds = 0;

  for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
    let plan: BonniePlan;
    try {
      const planned = await planWithDeepSeek(
        instruction,
        snapshot,
        history,
        moduleId,
        allToolResults,
        round
      );
      plan = planned.plan;
      model = planned.model;
      lastPlan = plan;
    } catch (err: any) {
      // JSON plan failed — fall back to conversational DeepChat reply
      try {
        const { text, model: chatModel } = await conversationalReply(instruction, history, moduleId, snapshot, onStreamToken);
        return {
          response: text,
          success: true,
          provider,
          model: chatModel,
          toolResults: allToolResults,
          logs: allLogs,
          rounds,
        };
      } catch {
        return {
          response: `Bonnie could not parse that request (${err.message}). Try a clear action, e.g. "run autonomous scan" or "list overdue invoices".`,
          success: false,
          provider,
          model,
          toolResults: allToolResults,
          logs: allLogs,
          rounds,
        };
      }
    }

    const toolCalls = plan.tool_calls || [];
    if (!toolCalls.length || plan.done === true) {
      break;
    }

    rounds += 1;
    allLogs.push(`Round ${rounds}: planning ${toolCalls.length} tool(s)`);

    const toolResults = await (
      await import('@/lib/bonnie/bonnieToolExecutor')
    ).executeBonnieToolCalls(tenantId, userId, toolCalls);

    allToolResults.push(...toolResults);
    allLogs.push(
      ...(plan.logs || []),
      ...toolResults.map((r) => `${r.success ? '✓' : '✗'} ${r.tool}: ${r.summary}`)
    );

    const allSucceeded = toolResults.every((r) => r.success);
    if (allSucceeded && toolCalls.length <= 2 && round >= 1) {
      break;
    }
  }

  let response = lastPlan.response || 'Done.';
  if (allToolResults.length) {
    const synthesized = await synthesizeWithDeepSeek(instruction, lastPlan, allToolResults, moduleId, onStreamToken).catch(
      () => null
    );
    if (synthesized?.trim()) response = synthesized.trim();
  }

  await persistBonnieLogs(tenantId, allLogs).catch(() => undefined);
  await persistRunnerActions(tenantId, instruction, allToolResults).catch(() => undefined);

  return {
    response,
    success: true,
    provider,
    model,
    toolResults: allToolResults,
    logs: allLogs,
    rounds,
  };
}
