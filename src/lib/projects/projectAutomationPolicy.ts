export type ProjectKickoffPolicy = {
  enabled: boolean;
  requireSignedContract: boolean;
  requireDeposit: boolean;
  minimumDepositAmount?: number | null;
  minimumDepositPercent?: number | null;
};

export type ProjectKickoffFacts = {
  contractSigned: boolean;
  contractValue?: number | null;
  amountPaid?: number | null;
  projectAlreadyExists?: boolean;
};

export type ProjectKickoffDecision = {
  eligible: boolean;
  reasons: string[];
  idempotentSuccess: boolean;
};

function money(value: number | null | undefined): number {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}

/**
 * Pure eligibility evaluator for automatic project creation.
 * Database/event state supplies the facts; LLM/UI state never decides eligibility.
 */
export function evaluateProjectKickoff(
  policy: ProjectKickoffPolicy,
  facts: ProjectKickoffFacts,
): ProjectKickoffDecision {
  if (facts.projectAlreadyExists) {
    return {
      eligible: true,
      reasons: ['A project already exists for this contract; treat the retry as successful.'],
      idempotentSuccess: true,
    };
  }

  const reasons: string[] = [];
  if (!policy.enabled) {
    return { eligible: false, reasons: ['Project automation policy is disabled.'], idempotentSuccess: false };
  }

  if (policy.requireSignedContract && !facts.contractSigned) {
    reasons.push('The contract has not reached the canonical signed state.');
  }

  if (policy.requireDeposit) {
    const paid = money(facts.amountPaid);
    const contractValue = money(facts.contractValue);
    const amountThreshold = money(policy.minimumDepositAmount);
    const percent = Math.min(100, Math.max(0, Number(policy.minimumDepositPercent || 0)));
    const percentThreshold = contractValue > 0 ? (contractValue * percent) / 100 : 0;
    const required = Math.max(amountThreshold, percentThreshold);

    if (required > 0 && paid < required) {
      reasons.push(`Deposit requirement is not met: ${paid} received, ${required} required.`);
    } else if (required === 0 && paid <= 0) {
      reasons.push('A deposit/payment is required before project creation.');
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons: reasons.length ? reasons : ['Configured project kickoff conditions are satisfied.'],
    idempotentSuccess: false,
  };
}

export function projectKickoffIdempotencyKey(input: {
  tenantId: string;
  contractId: string;
  policyVersion: number;
}): string {
  return `project-kickoff:${input.tenantId}:${input.contractId}:v${input.policyVersion}`;
}
