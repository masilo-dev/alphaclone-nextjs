import { runContractSignedFlow, type ContractSignedFlowInput } from '@/lib/contracts/contractSignedSteps';
import { runProjectAutomationEvent } from '@/lib/projects/projectAutomationService';

/**
 * Contract Signed Workflow
 * Canonical order remains contract signed → invoice → project + tasks.
 *
 * Projects V2 automation is an optional policy layer around the existing flow.
 * If the feature/policy is not enabled, legacy behavior is preserved.
 * If an enabled policy is waiting on payment/deposit, the legacy kickoff is
 * intentionally suppressed until the payment event re-evaluates eligibility.
 */
export async function contractSignedWorkflow({
  tenantId,
  payload,
  eventId,
}: {
  tenantId: string;
  payload: Record<string, unknown>;
  eventId?: string;
}) {
  "use workflow";

  const contractId = String(payload.contractId || '');
  if (!contractId) return;

  const actorUserId = typeof payload.actorUserId === 'string' ? payload.actorUserId : undefined;
  await runContractSignedFlowStep({ tenantId, contractId, actorUserId, eventId });
}

async function runContractSignedFlowStep(
  input: ContractSignedFlowInput & { eventId?: string },
) {
  "use step";

  const automation = await runProjectAutomationEvent({
    tenantId: input.tenantId,
    contractId: input.contractId,
    trigger: 'contract.signed',
    actorUserId: input.actorUserId,
    correlationId: input.eventId,
  });

  if (automation.status === 'disabled' || automation.status === 'not_configured') {
    return runContractSignedFlow(input);
  }

  return automation;
}
