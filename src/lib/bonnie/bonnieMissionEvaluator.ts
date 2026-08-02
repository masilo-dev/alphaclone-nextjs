import type { BonnieToolResult } from './bonnieToolTypes';

const ACTION_REQUEST =
  /\b(send|publish|post|upload|create|update|delete|schedule|charge|refund|move|assign|approve)\b/i;
const SUCCESS_CLAIM =
  /\b(done|completed|published|posted|uploaded|created|updated|deleted|scheduled|sent|successfully)\b/i;

export type MissionEvaluation = {
  passed: boolean;
  reason: string;
  verifiedToolCount: number;
};

/** Deterministic guard against an agent describing a write it never executed. */
export function evaluateMissionExecution(params: {
  instruction: string;
  response: string;
  toolResults: BonnieToolResult[];
}): MissionEvaluation {
  const verified = params.toolResults.filter((result) => result.success && !result.approvalRequired);
  const actionRequested = ACTION_REQUEST.test(params.instruction);
  const claimsSuccess = SUCCESS_CLAIM.test(params.response);

  if (actionRequested && claimsSuccess && verified.length === 0) {
    return {
      passed: false,
      reason: 'The response claims a write succeeded without a successful tool result.',
      verifiedToolCount: 0,
    };
  }

  return {
    passed: true,
    reason: verified.length ? 'Execution is backed by successful tool evidence.' : 'No unsupported success claim detected.',
    verifiedToolCount: verified.length,
  };
}
