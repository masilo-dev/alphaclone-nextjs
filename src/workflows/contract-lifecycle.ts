import { markContractSentForSignature } from '@/lib/contracts/contractLifecycleSteps';

/**
 * Contract Lifecycle Workflow — send for signature only.
 * After signature: invoice → project (contractSignedWorkflow in contract-flows.ts).
 */
export async function contractLifecycleWorkflow({
  contractId,
  tenantId,
}: {
  contractId: string;
  tenantId: string;
}) {
  "use workflow";
  await markContractSentForSignature(contractId, tenantId);
}
