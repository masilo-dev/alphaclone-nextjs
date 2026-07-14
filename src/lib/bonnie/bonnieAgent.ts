import { callDeepSeek, chatDeepSeek, streamDeepSeek } from '@/lib/ai/deepseek';
import { cleanProfessionalContent } from '@/services/aiRouter';
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
import { suggestToolsForQuestion } from '@/lib/bonnie/bonnieTenantDataRules';
import { warmBonnieWorkspaceContext, formatWarmContextBlock } from '@/lib/bonnie/bonnieWarmContext';
import { sanitizeBonnieResponse, BONNIE_ANTI_HEDGE_INSTRUCTION } from '@/lib/bonnie/bonnieResponseSanitizer';
import { isAIProviderUnavailableError } from '@/lib/ai/providerHealth';
import {
  BONNIE_MAX_AGENT_ROUNDS,
  looksLikeComplexMission,
} from '@/lib/bonnie/bonnieAgentConfig';

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
  executionStatus:
    | 'executed'
    | 'queued_for_approval'
    | 'read_only_answer'
    | 'planning_failed'
    | 'provider_blocked';
};

type BonniePlan = {
  response: string;
  tool_calls?: BonnieToolCall[];
  logs?: string[];
  done?: boolean;
};

const MAX_AGENT_ROUNDS = BONNIE_MAX_AGENT_ROUNDS;

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

/** Only skip tools for pure greetings — everything else uses the tool loop with tenant data. */
function looksLikePureChitchat(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length <= 3) return true;
  if (looksLikeActionInstruction(t)) return false;
  return /^(hi|hello|hey|thanks|thank you|ok|okay|bye|goodbye|good morning|good night)[!.?\s]*$/i.test(t);
}

function looksLikeActionInstruction(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /\b(send|post|publish|schedule|create|run|execute|sync|connect|audit|scan|draft|launch|approve|reject|update|delete|remove|add|import|export|remind|invoice|bill|message|whatsapp|email|campaign|linkedin|facebook|tweet|share|find|list|show|get|check|fix|retry|resume|pause|trigger)\b/.test(
    t
  );
}

function detectConversationMode(text: string): 'briefing' | 'autopilot' | 'query' | 'instruction' {
  const t = text.toLowerCase().trim();
  if (/\b(brief me|what needs attention|daily brief|morning brief|operator brief)\b/.test(t)) {
    return 'briefing';
  }
  if (/\b(autopilot|chief of staff|cos routine|run chief of staff)\b/.test(t)) {
    return 'autopilot';
  }
  if (/^(what is|how many|show me|list|who owes|how much|when is)\b/.test(t) && t.length < 120) {
    return 'query';
  }
  return 'instruction';
}

function isProviderBillingOrOutageText(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  return (
    normalized.includes('out of credits') ||
    normalized.includes('insufficient credits') ||
    normalized.includes('insufficient balance') ||
    normalized.includes('credit balance too low') ||
    normalized.includes('credits exhausted') ||
    normalized.includes('account not active') ||
    normalized.includes('payment required') ||
    normalized.includes('api error 402') ||
    normalized.includes('402') ||
    normalized.includes('openrouter')
  );
}

function formatBonniePlanningError(err: unknown): string {
  if (isAIProviderUnavailableError(err)) {
    return 'DeepSeek is unavailable. Set DEEPSEEK_API_KEY on Railway (alphaclone-web).';
  }
  const msg = err instanceof Error ? err.message : 'planning_failed';
  if (msg.includes('All AI providers failed') || msg.includes('DEEPSEEK_API_KEY')) {
    return 'DeepSeek is not configured or is out of credits. Add DEEPSEEK_API_KEY on the Railway web service.';
  }
  if (msg.includes('Unexpected token') || msg.includes('JSON')) {
    return 'Bonnie could not read the AI plan — try a clearer action like "list overdue invoices" or "run autonomous scan".';
  }
  return msg;
}

function detectProviderBlocked(toolResults: BonnieToolResult[]): boolean {
  return toolResults.some((r) => !r.success && isProviderBillingOrOutageText(r.summary || r.details || ''));
}

async function runBriefingMode(
  tenantId: string,
  userId: string,
  moduleId: BonnieModuleId
): Promise<BonnieAgentResult> {
  const { executeBonnieToolCalls } = await import('@/lib/bonnie/bonnieToolExecutor');
  const toolResults = await executeBonnieToolCalls(
    tenantId,
    userId,
    [
      { tool: 'solo_owner_operator_brief', arguments: { tenant_id: tenantId } },
      { tool: 'get_business_snapshot', arguments: { tenant_id: tenantId } },
    ],
    'briefing mode'
  );

  const synthesized = await synthesizeWithDeepSeek(
    'Give me a concise executive briefing of what needs my attention today.',
    { response: 'Briefing complete.' },
    toolResults,
    moduleId
  ).catch(() => null);

  return {
    response: synthesized?.trim() || 'Here is your workspace briefing based on the latest snapshot.',
    success: true,
    provider: process.env.DEEPSEEK_API_KEY ? 'bonnie-deepseek' : 'fallback',
    model: 'deepseek-chat',
    toolResults,
    logs: ['Briefing mode: solo_owner_operator_brief + get_business_snapshot'],
    rounds: 1,
    executionStatus: detectProviderBlocked(toolResults) ? 'provider_blocked' : 'executed',
  };
}

async function runAutopilotMode(
  tenantId: string,
  userId: string,
  moduleId: BonnieModuleId
): Promise<BonnieAgentResult> {
  const { executeBonnieToolCalls } = await import('@/lib/bonnie/bonnieToolExecutor');
  const toolResults = await executeBonnieToolCalls(
    tenantId,
    userId,
    [{ tool: 'run_chief_of_staff_routine', arguments: { tenant_id: tenantId } }],
    'autopilot mode'
  );

  const pending = toolResults.find((r) => r.approvalRequired);
  if (pending) {
    return {
      response: `Chief of Staff routine prepared "${pending.tool}" but needs your approval before it can complete.`,
      success: true,
      provider: process.env.DEEPSEEK_API_KEY ? 'bonnie-deepseek' : 'fallback',
      model: 'deepseek-chat',
      toolResults,
      logs: ['Autopilot mode: chief of staff routine queued approval'],
      rounds: 1,
      executionStatus: detectProviderBlocked(toolResults) ? 'provider_blocked' : 'queued_for_approval',
    };
  }

  const synthesized = await synthesizeWithDeepSeek(
    'Summarize the Chief of Staff routine results.',
    { response: 'Chief of Staff routine complete.' },
    toolResults,
    moduleId
  ).catch(() => null);

  return {
    response: synthesized?.trim() || 'Chief of Staff routine finished. Check activity logs for details.',
    success: toolResults.every((r) => r.success),
    provider: process.env.DEEPSEEK_API_KEY ? 'bonnie-deepseek' : 'fallback',
    model: 'deepseek-chat',
    toolResults,
    logs: ['Autopilot mode: run_chief_of_staff_routine'],
    rounds: 1,
    executionStatus: detectProviderBlocked(toolResults) ? 'provider_blocked' : 'executed',
  };
}

async function conversationalReply(
  instruction: string,
  history: BonnieAgentInput['history'],
  moduleId: BonnieModuleId,
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>,
  tenantId: string,
  onStreamToken?: (token: string) => void
): Promise<{ text: string; model: string }> {
  const systemPrompt = buildBonnieConversationalPrompt(moduleId, tenantId, snapshot);
  const contextBlock = `Workspace: ${snapshot.module_summary}\n\nUser:\n${instruction}`;

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

async function planWithDeepSeek(
  instruction: string,
  snapshot: Awaited<ReturnType<typeof getBonnieWorkspaceSnapshot>>,
  history: BonnieAgentInput['history'],
  moduleId: BonnieModuleId,
  priorToolResults: BonnieToolResult[],
  round: number,
  tenantId: string,
  warmPrefetch: BonnieToolResult[] = []
): Promise<{ plan: BonniePlan; model: string }> {
  const systemPrompt = await buildBonnieSystemPrompt(moduleId, tenantId);
  const priorBlock =
    priorToolResults.length > 0
      ? `\n\nPRIOR TOOL RESULTS (round ${round}):\n${JSON.stringify(
          priorToolResults.map((r) => ({
            tool: r.tool,
            success: r.success,
            summary: r.summary,
            approvalRequired: r.approvalRequired ?? false,
          })),
          null,
          2
        )}\nIf a tool shows approvalRequired, do NOT call it again — complete other prep work or set done:true and summarize what awaits approval. If the task is complete, set "done": true and return empty tool_calls with your final response. Otherwise continue with the next tool_calls needed.`
      : '';

  const suggestedTools = suggestToolsForQuestion(instruction, moduleId);
  const missionHint = looksLikeComplexMission(instruction)
    ? `\nCOMPLEX MISSION DETECTED: Prefer orchestrate_task for cross-module work, or chain multiple tool rounds until fully complete (gather → act → verify). Do not stop after the first successful tool.\n`
    : '';
  const userBlock = `WORKSPACE CONTEXT (already loaded — answer from this, do not ask to check):
${formatWarmContextBlock(snapshot, round === 0 ? warmPrefetch : [])}
${missionHint}
SUGGESTED READ TOOLS FOR THIS MESSAGE (run if you need fresher detail):
${suggestedTools.join(', ')}

USER INSTRUCTION:
${instruction}${priorBlock}

Plan like a power agent (Cursor/Devin style): fetch tenant data with tools when needed — never ask yes/no to read. Execute end-to-end until done or approval is queued. Round ${round + 1} of ${MAX_AGENT_ROUNDS}.`;

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

Write the final reply: what you did, key results, and clear next step if any. Plain text, concise, professional. No vendor names.
${BONNIE_ANTI_HEDGE_INSTRUCTION}`;

  if (onStreamToken) {
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

  let model = 'deepseek-chat';
  const provider = process.env.DEEPSEEK_API_KEY ? 'bonnie-deepseek' : 'fallback';

  const { snapshot, warmResults } = await warmBonnieWorkspaceContext(tenantId, userId, moduleId);
  const conversationMode = detectConversationMode(instruction);

  if (conversationMode === 'briefing') {
    const result = await runBriefingMode(tenantId, userId, moduleId);
    return { ...result, executionStatus: 'executed' };
  }

  if (conversationMode === 'autopilot') {
    const result = await runAutopilotMode(tenantId, userId, moduleId);
    const hasPending = result.toolResults.some((r) => r.approvalRequired);
    return { ...result, executionStatus: hasPending ? 'queued_for_approval' : 'executed' };
  }

  if (conversationMode === 'query') {
    const { executeBonnieToolCalls } = await import('@/lib/bonnie/bonnieToolExecutor');
    const suggested = suggestToolsForQuestion(instruction, moduleId).slice(0, 2);
    const queryTools = await executeBonnieToolCalls(
      tenantId,
      userId,
      suggested.map((tool) => ({ tool, arguments: { tenant_id: tenantId } })),
      instruction
    );
    const allQueryResults = [...warmResults, ...queryTools];
    try {
      const { text, model: chatModel } = await conversationalReply(
        `${instruction}\n\nData retrieved:\n${allQueryResults.map((r) => `${r.tool}: ${r.summary}`).join('\n')}`,
        history,
        moduleId,
        snapshot,
        tenantId,
        onStreamToken
      );
      return {
        response: text,
        success: true,
        provider,
        model: chatModel,
        toolResults: allQueryResults,
        logs: ['Query mode: targeted read tools + synthesis'],
        rounds: 1,
        executionStatus: detectProviderBlocked(allQueryResults) ? 'provider_blocked' : 'executed',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Query failed';
      return {
        response: `Bonnie could not answer that (${message}).`,
        success: false,
        provider,
        model,
        toolResults: allQueryResults,
        logs: [],
        rounds: 1,
        executionStatus: 'planning_failed',
      };
    }
  }

  // Pure chitchat only — all business/data questions use the tool loop
  if (looksLikePureChitchat(instruction)) {
    try {
      const { text, model: chatModel } = await conversationalReply(
        instruction,
        history,
        moduleId,
        snapshot,
        tenantId,
        onStreamToken
      );
      return {
        response: text,
        success: true,
        provider,
        model: chatModel,
        toolResults: [],
        logs: ['Conversational reply (no tools)'],
        rounds: 0,
        executionStatus: 'executed',
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
        executionStatus: 'planning_failed',
      };
    }
  }

  const allToolResults: BonnieToolResult[] = [...warmResults];
  const allLogs: string[] = warmResults.map((r) => `Prefetched ${r.tool}: ${r.summary}`);
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
        round,
        tenantId,
        warmResults
      );
      plan = planned.plan;
      model = planned.model;
      lastPlan = plan;
    } catch (err: any) {
      // JSON plan failed — treat as execution-planning failure, not a successful chat
      let fallbackText = '';
      try {
        const { text } = await conversationalReply(
          instruction,
          history,
          moduleId,
          snapshot,
          tenantId,
          onStreamToken
        );
        fallbackText = text;
      } catch {
        // ignore, we will return a generic planning failure message below
      }

      await persistBonnieLogs(tenantId, allLogs).catch(() => undefined);

      return {
        response:
          fallbackText ||
          `Bonnie could not parse that request (${formatBonniePlanningError(err)}). Try a clear action, e.g. "run autonomous scan" or "list overdue invoices".`,
        success: false,
        provider,
        model,
        toolResults: allToolResults,
        logs: allLogs,
        rounds,
        executionStatus: 'planning_failed',
      };
    }

    const toolCalls = plan.tool_calls || [];
    if (!toolCalls.length || plan.done === true) {
      break;
    }

    rounds += 1;
    allLogs.push(`Round ${rounds}: planning ${toolCalls.length} tool(s)`);

    const toolResults = await (
      await import('@/lib/bonnie/bonnieToolExecutor')
    ).executeBonnieToolCalls(tenantId, userId, toolCalls, instruction);

    allToolResults.push(...toolResults);
    allLogs.push(
      ...(plan.logs || []),
      ...toolResults.map((r) => `${r.success ? '✓' : '✗'} ${r.tool}: ${r.summary}`)
    );

    const pendingApprovals = toolResults.filter((r) => r.approvalRequired);
    if (pendingApprovals.length > 0) {
      allLogs.push(
        `${pendingApprovals.length} action(s) queued for inline approval — continuing prep work if needed`
      );
      lastPlan = {
        response:
          pendingApprovals.length === 1
            ? `I prepared "${pendingApprovals[0].tool}" and queued it for your approval. Review below and tap Approve to execute.`
            : `I prepared ${pendingApprovals.length} actions that need your approval before send/publish.`,
        done: false,
      };
      // Allow one more planning round to finish reads/drafts; agent should not retry queued tools.
      if (round >= MAX_AGENT_ROUNDS - 1) {
        lastPlan.done = true;
        break;
      }
      continue;
    }
  }

  let response = sanitizeBonnieResponse(lastPlan.response || 'Done.');
  if (allToolResults.length) {
    const synthesized = await synthesizeWithDeepSeek(instruction, lastPlan, allToolResults, moduleId, onStreamToken).catch(
      () => null
    );
    if (synthesized?.trim()) response = sanitizeBonnieResponse(synthesized.trim());
  }

  await persistBonnieLogs(tenantId, allLogs).catch(() => undefined);
  await persistRunnerActions(tenantId, instruction, allToolResults).catch(() => undefined);

  let finalToolResults = allToolResults;
  if (!finalToolResults.length && looksLikeActionInstruction(instruction)) {
    const { executeBonnieToolCalls } = await import('@/lib/bonnie/bonnieToolExecutor');
    const suggested = suggestToolsForQuestion(instruction, moduleId).slice(0, 3);
    if (suggested.length) {
      const forced = await executeBonnieToolCalls(
        tenantId,
        userId,
        suggested.map((tool) => ({ tool, arguments: { tenant_id: tenantId } })),
        instruction
      );
      finalToolResults = [...warmResults, ...forced];
      allLogs.push(...forced.map((r) => `Auto-run ${r.tool}: ${r.summary}`));
      if (forced.length) {
        const synthesized = await synthesizeWithDeepSeek(
          instruction,
          { response: lastPlan.response || 'Done.', done: true },
          finalToolResults,
          moduleId,
          onStreamToken
        ).catch(() => null);
        if (synthesized?.trim()) response = sanitizeBonnieResponse(synthesized.trim());
      }
    }
  }

  const anyTools = finalToolResults.length > 0;
  const anyApproval = finalToolResults.some((r) => r.approvalRequired);
  const providerBlocked = detectProviderBlocked(finalToolResults);

  return {
    response,
    success: true,
    provider,
    model,
    toolResults: finalToolResults,
    logs: allLogs,
    rounds,
    executionStatus: providerBlocked
      ? 'provider_blocked'
      : anyApproval
        ? 'queued_for_approval'
        : anyTools
          ? 'executed'
          : looksLikeActionInstruction(instruction)
            ? 'planning_failed'
            : 'executed',
  };
}
