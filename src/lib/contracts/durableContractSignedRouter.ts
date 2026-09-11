/**
 * Route contract-signed automation through Bonnie durable runtime when enabled.
 */

import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';
import { enqueueContractSignedTask } from '@/lib/contracts/contractSignedDurableTask';
import { start } from 'workflow/api';
import { contractSignedWorkflow } from '@/workflows/contract-flows';

export async function queueContractSigned(input: {
  tenantId: string;
  contractId: string;
  userId?: string;
  eventId?: string;
}): Promise<{ durable: boolean; run_id: string; task_id?: string; poll_tool: string }> {
  if (isDurableRuntimeEnabled()) {
    const enqueued = await enqueueContractSignedTask({
      tenantId: input.tenantId,
      userId: input.userId,
      contractId: input.contractId,
      idempotencyKey: input.eventId ? `contract-signed-${input.eventId}` : undefined,
    });
    return {
      durable: true,
      run_id: enqueued.runId,
      task_id: enqueued.taskId,
      poll_tool: 'get_outcome_status',
    };
  }

  const { runId } = await start(contractSignedWorkflow, [
    {
      tenantId: input.tenantId,
      payload: {
        contractId: input.contractId,
        actorUserId: input.userId,
      },
    },
  ]);
  return {
    durable: false,
    run_id: runId,
    poll_tool: 'get_outcome_status',
  };
}
