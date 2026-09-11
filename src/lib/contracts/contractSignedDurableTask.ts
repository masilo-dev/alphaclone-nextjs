/**
 * Durable contract-signed automation on Bonnie worker.
 */

import { createGraphTransactional } from '@/lib/bonnie/runtime/graphService';
import { createRunForObjective } from '@/lib/bonnie/runtime/goalRunService';
import { insertOutboxEvent } from '@/lib/bonnie/runtime/outboxService';
import type { GraphTaskInput } from '@/lib/bonnie/runtime/types';
import { runContractSignedFlow } from '@/lib/contracts/contractSignedSteps';

export async function enqueueContractSignedTask(input: {
  tenantId: string;
  userId?: string;
  contractId: string;
  idempotencyKey?: string;
}): Promise<{ runId: string; taskId: string }> {
  const idempotencyKey = input.idempotencyKey || `contract-signed-${input.contractId}`;

  const runResult = await createRunForObjective({
    tenantId: input.tenantId,
    userId: input.userId || null,
    objective: `Contract signed ${input.contractId.slice(0, 8)}`,
    executionMode: 'autonomous',
    successCriteria: { contractId: input.contractId, requireProject: true },
    seedGraph: false,
  });

  const task: GraphTaskInput = {
    tempId: 't_contract_signed',
    title: 'Process signed contract (invoice + project)',
    taskType: 'contract.signed',
    assignedAgentId: 'contracts',
    status: 'READY',
    riskLevel: 'high',
    structuredInput: {
      tenantId: input.tenantId,
      contractId: input.contractId,
      actorUserId: input.userId || null,
    },
    idempotencyKey,
    retryPolicy: { maxAttempts: 3, backoffMs: 120_000 },
  };

  const graph = await createGraphTransactional({
    tenantId: input.tenantId,
    runId: runResult.run.id,
    tasks: [task],
    reason: 'contract_signed_enqueue',
    actorType: 'api',
    actorId: input.userId || 'system',
  });

  const taskId = graph.taskIds[0];
  if (!taskId) throw new Error('Failed to enqueue contract signed task');

  await insertOutboxEvent({
    tenantId: input.tenantId,
    eventType: 'contract.signed.enqueued',
    payload: { task_id: taskId, run_id: runResult.run.id, contract_id: input.contractId },
    correlationId: idempotencyKey,
  });

  return { runId: runResult.run.id, taskId };
}

export async function executeContractSignedTask(params: {
  tenantId: string;
  task: Record<string, unknown>;
}): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const input = (params.task.structured_input || {}) as Record<string, unknown>;
  const contractId = String(input.contractId || '');
  const tenantId = String(input.tenantId || params.tenantId);
  const actorUserId =
    typeof input.actorUserId === 'string' && input.actorUserId ? input.actorUserId : undefined;

  if (!contractId) return { ok: false, error: 'missing_contract_id' };

  try {
    const result = await runContractSignedFlow({
      tenantId,
      contractId,
      actorUserId,
    });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'contract_signed_failed' };
  }
}
