import { runContractSignedFlow, type ContractSignedFlowInput } from '@/lib/contracts/contractSignedSteps';

/**
 * Contract Signed Workflow
 * Canonical order: contract signed → invoice → project + tasks.
 */
export async function contractSignedWorkflow({
  tenantId,
  payload,
}: {
  tenantId: string;
  payload: Record<string, unknown>;
}) {
  "use workflow";

  const contractId = String(payload.contractId || '');
  if (!contractId) return;

  const actorUserId = typeof payload.actorUserId === 'string' ? payload.actorUserId : undefined;
  await runContractSignedFlowStep({ tenantId, contractId, actorUserId });
}

async function runContractSignedFlowStep(input: ContractSignedFlowInput) {
  "use step";
  return runContractSignedFlow(input);
}
