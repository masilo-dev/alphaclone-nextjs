
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
  await sendContractStep(contractId, tenantId);
}

async function sendContractStep(contractId: string, tenantId: string) {
  "use step";
  const { markContractSentForSignature } = await import('@/lib/contracts/contractLifecycleSteps');
  return markContractSentForSignature(contractId, tenantId);
}
