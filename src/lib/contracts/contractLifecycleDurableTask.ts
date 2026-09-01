/**
 * Durable contract lifecycle marker on Bonnie worker.
 */

import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { createRunForObjective } from '@/lib/bonnie/runtime/goalRunService';
import { insertOutboxEvent } from '@/lib/bonnie/runtime/outboxService';
import type { GraphTaskInput } from '@/lib/bonnie/runtime/types';
import { markContractSentForSignature } from '@/lib/contracts/contractLifecycleSteps';

export async function enqueueContractLifecycleTask(input: {
  tenantId: string;
  userId?: string;
  contractId: string;
}): Promise<{ runId: string; taskId: string }> {
  const runResult = await createRunForObjective({
    tenantId: input.tenantId,
    userId: input.userId || null,
    objective: `Contract lifecycle ${input.contractId.slice(0, 8)}`,
    executionMode: 'autonomous',
    successCriteria: { contractId: input.contractId, requireSent: true },
    seedGraph: false,
  });

  const task: GraphTaskInput = {
    tempId: 't_contract_lifecycle',
    title: 'Advance contract lifecycle',
    taskType: 'contract.lifecycle',
    assignedAgentId: 'contracts',
    status: 'READY',
    riskLevel: 'medium',
    structuredInput: {
      tenantId: input.tenantId,
      contractId: input.contractId,
    },
    retryPolicy: { maxAttempts: 3, backoffMs: 60_000 },
  };

  const graph = await createGraphTransactional({
    tenantId: input.tenantId,
    runId: runResult.run.id,
    tasks: [task],
    reason: 'contract_lifecycle_enqueue',
    actorType: 'api',
    actorId: input.userId || 'system',
  });

  const taskId = graph.taskIds[0];
  if (!taskId) throw new Error('Failed to enqueue contract lifecycle task');

  await insertOutboxEvent({
    tenantId: input.tenantId,
    eventType: 'contract.lifecycle.enqueued',
    payload: { task_id: taskId, run_id: runResult.run.id, contract_id: input.contractId },
  });

  return { runId: runResult.run.id, taskId };
}

export async function executeContractLifecycleTask(params: {
  tenantId: string;
  task: Record<string, unknown>;
}): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const input = (params.task.structured_input || {}) as Record<string, unknown>;
  const contractId = String(input.contractId || '');
  const tenantId = String(input.tenantId || params.tenantId);
  if (!contractId) return { ok: false, error: 'missing_contract_id' };

  try {
    const result = await markContractSentForSignature(contractId, tenantId);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'contract_lifecycle_failed' };
  }
}
