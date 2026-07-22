/**
 * Bonnie Supervisor — continuously evaluates which agents should act,
 * whether collaboration/approval/retry is needed, and how to update memory.
 */

import { DEPARTMENT_AGENTS, getAgentById } from './agentRegistry';
import type { BonnieAgentDefinition, RiskLevel, SupervisorDecision } from './types';

const HIGH_RISK_PATTERNS =
  /\b(send|charge|refund|delete|bulk|wire|payout|publish|invoice\s+send|financial)\b/i;

const EVENT_AGENT_MAP: Record<string, string[]> = {
  lead_created: ['research', 'crm', 'sales', 'email'],
  deal_stage_changed: ['sales', 'crm', 'reporting'],
  invoice_created: ['accounting', 'finance'],
  invoice_overdue: ['finance', 'accounting', 'email', 'customer_success'],
  invoice_paid: ['finance', 'accounting', 'reporting'],
  contract_signed: ['document', 'customer_success', 'finance'],
  task_overdue: ['coo', 'workflow', 'support'],
  task_created: ['coo', 'workflow'],
  ticket_created: ['support', 'customer_success'],
  email_received: ['email', 'crm', 'sales'],
  meeting_scheduled: ['calendar', 'sales', 'crm'],
  payment_failed: ['finance', 'accounting', 'support'],
  employee_updated: ['coo', 'compliance'],
  approval_requested: ['compliance', 'audit', 'supervisor'],
};

function scoreAgent(agent: BonnieAgentDefinition, goal: string): number {
  const t = goal.toLowerCase();
  let score = agent.priority ?? 1;
  for (const kw of agent.keywords) {
    if (t.includes(kw.toLowerCase())) score += 4;
  }
  // Light boosts for common business nouns
  if (agent.id === 'crm' && /\b(contact|lead|deal|client)\b/.test(t)) score += 3;
  if (agent.id === 'finance' && /\b(invoice|revenue|overdue|cash)\b/.test(t)) score += 3;
  if (agent.id === 'sales' && /\b(pipeline|close|outreach|qualify)\b/.test(t)) score += 3;
  return score;
}

export function selectAgentsForGoal(
  goal: string,
  opts?: { eventType?: string; maxAgents?: number }
): BonnieAgentDefinition[] {
  const maxAgents = opts?.maxAgents ?? 4;
  const forcedIds = opts?.eventType ? EVENT_AGENT_MAP[opts.eventType] || [] : [];
  const forced = forcedIds
    .map((id) => getAgentById(id))
    .filter((a): a is BonnieAgentDefinition => Boolean(a));

  const scored = DEPARTMENT_AGENTS
    .filter((a) => a.id !== 'supervisor')
    .map((a) => ({ agent: a, score: scoreAgent(a, goal) }))
    .sort((a, b) => b.score - a.score);

  const picked = new Map<string, BonnieAgentDefinition>();
  for (const a of forced) picked.set(a.id, a);
  for (const { agent, score } of scored) {
    if (picked.size >= maxAgents) break;
    if (score < 8 && forced.length > 0) continue;
    if (score < 6 && forced.length === 0 && picked.size >= 2) continue;
    picked.set(agent.id, agent);
  }

  // Always include audit for explainability on multi-agent work
  if (picked.size >= 2 && !picked.has('audit')) {
    const audit = getAgentById('audit');
    if (audit) picked.set('audit', audit);
  }

  if (picked.size === 0) {
    const crm = getAgentById('crm');
    const reporting = getAgentById('reporting');
    if (crm) picked.set('crm', crm);
    if (reporting) picked.set('reporting', reporting);
  }

  return Array.from(picked.values()).slice(0, maxAgents);
}

export function estimateRiskLevel(goal: string, tools: string[] = []): RiskLevel {
  if (HIGH_RISK_PATTERNS.test(goal) || tools.some((t) => /send|charge|delete|bulk|publish/i.test(t))) {
    return 'high';
  }
  if (/\b(update|create|schedule|draft|move)\b/i.test(goal)) return 'medium';
  return 'low';
}

export function decideSupervision(params: {
  goal: string;
  eventType?: string;
  selectedAgents?: BonnieAgentDefinition[];
  selectedTools?: string[];
  priorFailures?: number;
}): SupervisorDecision {
  const agents = params.selectedAgents || selectAgentsForGoal(params.goal, { eventType: params.eventType });
  const tools = params.selectedTools || agents.flatMap((a) => a.tools).slice(0, 12);
  const riskLevel = estimateRiskLevel(params.goal, tools);
  const primary = agents.slice(0, 2).map((a) => a.id);
  const collaborators = agents.slice(2).map((a) => a.id);
  const requiresApproval = riskLevel === 'high' || riskLevel === 'critical';
  const shouldRetryStrategy = (params.priorFailures || 0) > 0 && (params.priorFailures || 0) < 3;
  const shouldStop = (params.priorFailures || 0) >= 3;
  const multiDept = new Set(agents.map((a) => a.department)).size >= 2;

  let strategy = 'single_specialist';
  if (multiDept) strategy = 'multi_agent_collaboration';
  if (requiresApproval) strategy = `${strategy}_with_approval`;
  if (shouldRetryStrategy) strategy = 'alternate_strategy_retry';

  const confidence = Math.max(
    0.35,
    Math.min(0.95, 0.55 + agents.length * 0.06 - (requiresApproval ? 0.08 : 0))
  );

  return {
    primaryAgentIds: primary,
    collaboratorAgentIds: collaborators,
    shouldStop,
    requiresApproval,
    shouldRetryStrategy,
    shouldUpdateMemory: true,
    shouldPromoteWorkflow: multiDept && !requiresApproval,
    reasoning: `Selected ${agents.map((a) => a.name).join(', ')} for goal. Risk=${riskLevel}. Strategy=${strategy}.`,
    confidence,
    strategy,
    riskLevel,
  };
}

export function collectToolsFromAgents(agents: BonnieAgentDefinition[], limit = 16): string[] {
  const seen = new Set<string>();
  const tools: string[] = [];
  for (const agent of agents) {
    for (const tool of agent.tools) {
      if (seen.has(tool)) continue;
      seen.add(tool);
      tools.push(tool);
      if (tools.length >= limit) return tools;
    }
  }
  return tools;
}
