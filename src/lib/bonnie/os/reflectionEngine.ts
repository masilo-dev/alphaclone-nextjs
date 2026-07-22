/**
 * Reflection after every Bonnie task — learn, update memory, improve future execution.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { upsertLayeredMemory } from './layeredMemory';
import type { CognitiveStageRecord, ReflectionResult, SupervisorDecision } from './types';

export function synthesizeReflection(params: {
  goal: string;
  stages: CognitiveStageRecord[];
  supervisor: SupervisorDecision;
  outcome: Record<string, unknown>;
  toolResults?: Array<{ tool?: string; success?: boolean; approvalRequired?: boolean; summary?: string }>;
}): ReflectionResult {
  const whatWorked: string[] = [];
  const whatFailed: string[] = [];
  const lessons: string[] = [];
  const improvementActions: string[] = [];

  const completedStages = params.stages.filter((s) => s.status === 'completed');
  const failedStages = params.stages.filter((s) => s.status === 'failed');

  if (completedStages.length) {
    whatWorked.push(`Completed cognitive stages: ${completedStages.map((s) => s.name).join(', ')}`);
  }
  if (params.supervisor.primaryAgentIds.length) {
    whatWorked.push(`Supervisor selected primary agents: ${params.supervisor.primaryAgentIds.join(', ')}`);
  }

  const failedTools = (params.toolResults || []).filter((t) => t.success === false);
  const approved = (params.toolResults || []).filter((t) => t.approvalRequired);
  for (const t of failedTools) {
    whatFailed.push(`Tool failed: ${t.tool || 'unknown'}${t.summary ? ` — ${t.summary}` : ''}`);
  }
  for (const s of failedStages) {
    whatFailed.push(`Stage failed: ${s.name}${s.summary ? ` — ${s.summary}` : ''}`);
  }
  if (approved.length) {
    lessons.push('High-risk actions correctly routed to human approval before irreversible execution.');
  }
  if (params.supervisor.requiresApproval) {
    lessons.push('Risk policy required approval — preserve this gate for similar future goals.');
  }
  if (failedTools.length) {
    improvementActions.push('Prefer alternate tools or retry with narrower arguments on next similar run.');
    lessons.push('Failure recovery should prefer smaller scoped tool calls before bulk actions.');
  }
  if (params.supervisor.shouldPromoteWorkflow) {
    improvementActions.push('Promote this multi-department path into a reusable workflow playbook.');
  }

  lessons.push(`Strategy used: ${params.supervisor.strategy}`);
  if (!whatFailed.length) {
    whatWorked.push('No tool or stage failures recorded.');
  }

  const memoryUpdates: ReflectionResult['memoryUpdates'] = [
    {
      scope: 'organization',
      category: 'pattern',
      key: `goal_${slug(params.goal)}`,
      value: {
        summary: `Goal "${params.goal.slice(0, 120)}" used strategy ${params.supervisor.strategy}`,
        agents: params.supervisor.primaryAgentIds,
        risk: params.supervisor.riskLevel,
        outcome_status: params.outcome.status || 'unknown',
      },
      confidence: params.supervisor.confidence,
    },
    {
      scope: 'short_term',
      category: 'workflow',
      key: `last_run_${Date.now()}`,
      value: {
        summary: `Recent run confidence=${params.supervisor.confidence.toFixed(2)} risk=${params.supervisor.riskLevel}`,
        what_worked: whatWorked.slice(0, 3),
        what_failed: whatFailed.slice(0, 3),
      },
      confidence: params.supervisor.confidence,
    },
  ];

  if (params.supervisor.primaryAgentIds[0]) {
    memoryUpdates.push({
      scope: 'department',
      department: params.supervisor.primaryAgentIds[0],
      category: 'reliability',
      key: 'last_outcome',
      value: {
        summary: whatFailed.length ? 'Needs recovery focus' : 'Successful department contribution',
        failures: whatFailed.slice(0, 2),
      },
      confidence: whatFailed.length ? 0.55 : 0.8,
    });
  }

  return {
    whatWorked,
    whatFailed,
    lessons,
    memoryUpdates,
    workflowReuseCandidate: params.supervisor.shouldPromoteWorkflow && whatFailed.length === 0,
    improvementActions,
    confidence: params.supervisor.confidence,
  };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'goal';
}

export async function persistReflection(params: {
  tenantId: string;
  cognitiveRunId?: string | null;
  workflowId?: string | null;
  reflection: ReflectionResult;
}): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('bonnie_reflections')
    .insert({
      tenant_id: params.tenantId,
      cognitive_run_id: params.cognitiveRunId || null,
      workflow_id: params.workflowId || null,
      what_worked: params.reflection.whatWorked,
      what_failed: params.reflection.whatFailed,
      lessons: params.reflection.lessons,
      memory_updates: params.reflection.memoryUpdates,
      workflow_reuse_candidate: params.reflection.workflowReuseCandidate,
      improvement_actions: params.reflection.improvementActions,
      confidence: params.reflection.confidence,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[reflection] persist failed:', error.message);
    return null;
  }
  return data?.id || null;
}

export async function applyReflectionMemory(
  tenantId: string,
  reflection: ReflectionResult
): Promise<number> {
  let applied = 0;
  for (const update of reflection.memoryUpdates) {
    const result = await upsertLayeredMemory(tenantId, {
      scope: update.scope,
      department: update.department,
      category: update.category as 'preference' | 'pattern' | 'workflow' | 'reliability' | 'general',
      key: update.key,
      value: update.value,
      source: 'agent',
      confidence: update.confidence,
    });
    if (result.success) applied += 1;
  }
  return applied;
}
