/**
 * Bonnie Goal Engine — persistent goal objects with agent subtasks.
 * Goals outlive chat sessions; the chase loop resumes work automatically.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { BonnieAgentDefinition, CognitiveRunResult, RiskLevel } from './types';

export type GoalStatus =
  | 'draft'
  | 'active'
  | 'blocked'
  | 'awaiting_approval'
  | 'monitoring'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type GoalExecutionMode =
  | 'ask_only'
  | 'plan_only'
  | 'approval_required'
  | 'semi_autonomous'
  | 'fully_autonomous';

export type SubtaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'awaiting_approval'
  | 'done'
  | 'skipped'
  | 'failed';

export type BonnieGoalRecord = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress_pct: number;
  priority: number;
  execution_mode: GoalExecutionMode;
  owner_agent_id: string | null;
  source_trigger: string | null;
  source_event_type: string | null;
  source_event_id: string | null;
  conversation_id: string | null;
  workflow_id: string | null;
  latest_cognitive_run_id: string | null;
  waiting_for: string | null;
  blocker_reason: string | null;
  metadata: Record<string, unknown>;
  linked_record_ids: unknown[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type BonnieGoalSubtask = {
  id: string;
  goal_id: string;
  tenant_id: string;
  title: string;
  status: SubtaskStatus;
  assigned_agent_id: string | null;
  tools: unknown[];
  sort_order: number;
  blocker_reason: string | null;
  progress_pct: number;
  result: Record<string, unknown>;
};

function titleFromGoal(goal: string): string {
  const cleaned = goal.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 120) || 'Untitled goal';
}

function modeFromRisk(risk: RiskLevel, requiresApproval: boolean): GoalExecutionMode {
  if (risk === 'critical' || risk === 'high' || requiresApproval) return 'approval_required';
  if (risk === 'medium') return 'semi_autonomous';
  return 'semi_autonomous';
}

export async function createGoalFromPlan(params: {
  tenantId: string;
  userId?: string | null;
  goal: string;
  agents: BonnieAgentDefinition[];
  tools: string[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  triggerType?: string;
  eventType?: string;
  eventId?: string;
  conversationId?: string | null;
  workflowId?: string | null;
  cognitiveRunId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<BonnieGoalRecord | null> {
  const admin = createSupabaseAdminClient();
  const owner = params.agents[0]?.id || 'coo';
  const now = new Date().toISOString();

  const { data: goalRow, error } = await admin
    .from('bonnie_goals')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      title: titleFromGoal(params.goal),
      description: params.goal,
      status: params.requiresApproval ? 'awaiting_approval' : 'active',
      progress_pct: 5,
      priority: params.riskLevel === 'critical' ? 1 : params.riskLevel === 'high' ? 2 : 3,
      execution_mode: modeFromRisk(params.riskLevel, params.requiresApproval),
      owner_agent_id: owner,
      source_trigger: params.triggerType || 'instruction',
      source_event_type: params.eventType || null,
      source_event_id: params.eventId || null,
      conversation_id: params.conversationId || null,
      workflow_id: params.workflowId || null,
      latest_cognitive_run_id: params.cognitiveRunId || null,
      waiting_for: params.requiresApproval ? 'approval' : null,
      metadata: {
        ...(params.metadata || {}),
        agentIds: params.agents.map((a) => a.id),
        plannedTools: params.tools,
      },
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !goalRow) {
    console.warn('[goalEngine] create goal failed:', error?.message);
    return null;
  }

  const subtasks = buildSubtasksFromAgents(params.agents, params.tools);
  if (subtasks.length) {
    await admin.from('bonnie_goal_subtasks').insert(
      subtasks.map((s, index) => ({
        goal_id: goalRow.id,
        tenant_id: params.tenantId,
        sort_order: index,
        title: s.title,
        status: index === 0 ? 'ready' : 'pending',
        assigned_agent_id: s.agentId,
        tools: s.tools,
        progress_pct: 0,
        cognitive_run_id: params.cognitiveRunId || null,
      }))
    );
  }

  if (params.cognitiveRunId) {
    await admin
      .from('bonnie_cognitive_runs')
      .update({ goal_id: goalRow.id })
      .eq('id', params.cognitiveRunId);
  }

  return goalRow as BonnieGoalRecord;
}

function buildSubtasksFromAgents(
  agents: BonnieAgentDefinition[],
  tools: string[]
): Array<{ title: string; agentId: string; tools: string[] }> {
  const out: Array<{ title: string; agentId: string; tools: string[] }> = [
    {
      title: 'Understand objective and gather context',
      agentId: 'coo',
      tools: ['summarize_workspace', 'get_business_snapshot'],
    },
  ];

  for (const agent of agents.slice(0, 4)) {
    const agentTools = agent.tools.filter((t) => tools.includes(t)).slice(0, 3);
    out.push({
      title: `${agent.name}: execute specialist plan`,
      agentId: agent.id,
      tools: agentTools.length ? agentTools : agent.tools.slice(0, 2),
    });
  }

  out.push({
    title: 'Verify outcomes and update memory',
    agentId: 'evaluation',
    tools: ['recommend_next_steps'],
  });
  out.push({
    title: 'Continue monitoring until objective is complete',
    agentId: 'supervisor',
    tools: [],
  });

  return out;
}

export async function syncGoalWithCognitiveResult(params: {
  goalId: string;
  result: CognitiveRunResult;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const status: GoalStatus =
    params.result.status === 'awaiting_approval'
      ? 'awaiting_approval'
      : params.result.status === 'failed'
        ? 'failed'
        : params.result.status === 'completed'
          ? 'monitoring'
          : 'active';

  const progress =
    status === 'failed'
      ? 100
      : status === 'awaiting_approval'
        ? 45
        : status === 'monitoring'
          ? 85
          : 60;

  await admin
    .from('bonnie_goals')
    .update({
      status,
      progress_pct: progress,
      latest_cognitive_run_id: params.result.runId,
      waiting_for: status === 'awaiting_approval' ? 'approval' : status === 'monitoring' ? 'outcome' : null,
      blocker_reason:
        status === 'awaiting_approval'
          ? 'Waiting for human approval on high-risk actions'
          : status === 'failed'
            ? 'Cognitive run verification failed'
            : null,
      updated_at: new Date().toISOString(),
      completed_at: status === 'failed' ? new Date().toISOString() : null,
      metadata: {
        lastConfidence: params.result.confidence,
        lastStrategy: params.result.supervisor.strategy,
        selectedAgents: params.result.selectedAgents.map((a) => a.id),
      },
    })
    .eq('id', params.goalId);

  // Mark early subtasks done / awaiting based on result
  const { data: subs } = await admin
    .from('bonnie_goal_subtasks')
    .select('id, sort_order, status')
    .eq('goal_id', params.goalId)
    .order('sort_order', { ascending: true });

  if (!subs?.length) return;

  for (const sub of subs) {
    if (sub.sort_order <= 1) {
      await admin
        .from('bonnie_goal_subtasks')
        .update({
          status: 'done',
          progress_pct: 100,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          result: { cognitiveStatus: params.result.status },
        })
        .eq('id', sub.id);
    } else if (status === 'awaiting_approval' && sub.sort_order === 2) {
      await admin
        .from('bonnie_goal_subtasks')
        .update({
          status: 'awaiting_approval',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);
    } else if (status === 'monitoring' && sub.sort_order >= subs.length - 1) {
      await admin
        .from('bonnie_goal_subtasks')
        .update({
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id);
    }
  }
}

export async function listGoals(params: {
  tenantId: string;
  userId?: string | null;
  status?: GoalStatus[] | 'open';
  limit?: number;
}): Promise<BonnieGoalRecord[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('bonnie_goals')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .order('updated_at', { ascending: false })
    .limit(params.limit || 40);

  if (params.userId) query = query.eq('user_id', params.userId);
  if (params.status === 'open') {
    query = query.in('status', ['draft', 'active', 'blocked', 'awaiting_approval', 'monitoring']);
  } else if (params.status?.length) {
    query = query.in('status', params.status);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[goalEngine] listGoals failed:', error.message);
    return [];
  }
  return (data || []) as BonnieGoalRecord[];
}

export async function getGoalWithSubtasks(goalId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data: goal } = await admin
    .from('bonnie_goals')
    .select('*')
    .eq('id', goalId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!goal) return null;

  const { data: subtasks } = await admin
    .from('bonnie_goal_subtasks')
    .select('*')
    .eq('goal_id', goalId)
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  return { goal: goal as BonnieGoalRecord, subtasks: (subtasks || []) as BonnieGoalSubtask[] };
}

/**
 * Chase open goals: resume monitoring/active goals that are waiting on outcomes.
 * Returns count of goals advanced.
 */
export async function chaseOpenGoals(params: {
  tenantId: string;
  userId?: string;
  limit?: number;
  runCognitive?: (goal: BonnieGoalRecord) => Promise<CognitiveRunResult | null>;
}): Promise<{ chased: number; completed: number; awaiting: number }> {
  const open = await listGoals({
    tenantId: params.tenantId,
    status: 'open',
    limit: params.limit || 10,
  });

  let chased = 0;
  let completed = 0;
  let awaiting = 0;
  const admin = createSupabaseAdminClient();

  for (const goal of open) {
    if (goal.status === 'awaiting_approval') {
      awaiting += 1;
      continue;
    }

    // Auto-complete monitoring goals that have been idle with high progress
    if (goal.status === 'monitoring' && Number(goal.progress_pct) >= 85) {
      if (!params.runCognitive) {
        await admin
          .from('bonnie_goals')
          .update({
            status: 'completed',
            progress_pct: 100,
            waiting_for: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', goal.id);
        completed += 1;
        chased += 1;
        continue;
      }
    }

    if (params.runCognitive && (goal.status === 'active' || goal.status === 'monitoring' || goal.status === 'blocked')) {
      const result = await params.runCognitive(goal);
      chased += 1;
      if (result?.status === 'awaiting_approval') awaiting += 1;
      if (result?.status === 'completed') {
        await admin
          .from('bonnie_goals')
          .update({
            status: 'completed',
            progress_pct: 100,
            waiting_for: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            latest_cognitive_run_id: result.runId,
          })
          .eq('id', goal.id);
        completed += 1;
      } else if (result) {
        await syncGoalWithCognitiveResult({ goalId: goal.id, result });
      }
    }
  }

  return { chased, completed, awaiting };
}

export async function wakeGoalsForEvent(params: {
  tenantId: string;
  eventType: string;
  eventId?: string;
  payload?: Record<string, unknown>;
}): Promise<BonnieGoalRecord[]> {
  const admin = createSupabaseAdminClient();
  const waitingMap: Record<string, string[]> = {
    invoice_paid: ['payment', 'invoice_payment', 'outcome'],
    invoice_overdue: ['payment', 'outcome'],
    contract_signed: ['signed_contract', 'contract', 'outcome'],
    email_received: ['customer_reply', 'email', 'outcome'],
    payment_failed: ['payment', 'outcome'],
    lead_created: ['lead', 'outcome'],
    lead_updated: ['lead', 'outcome'],
    approval_requested: ['approval'],
    document_uploaded: ['document_approval', 'document', 'outcome'],
    social_post_published: ['social', 'outcome'],
    campaign_finished: ['campaign', 'outcome'],
    support_ticket_closed: ['ticket', 'customer_reply', 'outcome'],
    calendar_changed: ['calendar_event', 'outcome'],
    oauth_expiring: ['oauth', 'integration', 'outcome'],
  };
  const waits = waitingMap[params.eventType] || ['outcome'];

  const { data } = await admin
    .from('bonnie_goals')
    .select('*')
    .eq('tenant_id', params.tenantId)
    .in('status', ['active', 'blocked', 'monitoring', 'awaiting_approval'])
    .in('waiting_for', waits)
    .order('updated_at', { ascending: true })
    .limit(20);

  const woken: BonnieGoalRecord[] = [];
  for (const goal of data || []) {
    await admin
      .from('bonnie_goals')
      .update({
        status: 'active',
        waiting_for: null,
        blocker_reason: null,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(goal.metadata || {}),
          lastWakeEvent: params.eventType,
          lastWakeEventId: params.eventId || null,
          lastWakePayload: params.payload || {},
        },
      })
      .eq('id', goal.id);
    woken.push({ ...goal, status: 'active', waiting_for: null } as BonnieGoalRecord);
  }
  return woken;
}
