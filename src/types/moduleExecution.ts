/**
 * AlphaClone Systems — Universal Module Execution Types
 * Defines standard operational state, 8-question audit structure, and authority levels.
 */

export type ExecutionAuthorityLevel =
  | 'automatic'
  | 'automatic_logged'
  | 'approval_required'
  | 'human_decision_required';

export type OutcomeVerificationStatus =
  | 'pending'
  | 'verified'
  | 'failed'
  | 'escalated'
  | 'retrying'
  | 'YES'
  | 'NO'
  | 'IN_PROGRESS'
  | 'PARTIALLY'
  | 'BLOCKED';

export interface UniversalNextActionState {
  currentState: string;
  owner: string;
  nextAction: string;
  deadline?: string;
  blocker?: string | null;
  expectedOutcome: string;
  verifiedResult?: string;
  outcomeStatus?: OutcomeVerificationStatus;
  authorityLevel: ExecutionAuthorityLevel;
  lastUpdated?: string;
}

export interface ModuleExecutionQuestions {
  whatCameIn: string; // 1. Input / Event / Request
  whatDoesItMean: string; // 2. Business Context & Relationship
  whatShouldHappen: string; // 3. Logical Next Action
  whoOwnsIt: string; // 4. Owner (person, agent, system)
  canAlphaCloneAct: ExecutionAuthorityLevel; // 5. Authority level & confidence
  whatActuallyHappened?: string; // 6. Action & result log
  didItProduceExpectedOutcome?: OutcomeVerificationStatus; // 7. Verification of business outcome
  whatHappensNext?: string; // 8. Next action / escalation / follow-up
}

export interface ModuleAuditMatrixResult {
  moduleName: string;
  receivesInformation: boolean;
  understandsContext: boolean;
  connectsRelatedRecords: boolean;
  determinesNextAction: boolean;
  hasClearOwnership: boolean;
  supportsDecisions: boolean;
  canTriggerExecution: boolean;
  recordsExecution: boolean;
  verifiesOutcome: boolean;
  handlesFailure: boolean;
  updatesRelatedModules: boolean;
  createsNextAction: boolean;
  preservesHistory: boolean;
  providesMeasurableOutcome: boolean;
  status: 'STABILIZED' | 'PASSIVE / NOT FULLY STABILIZED';
}
