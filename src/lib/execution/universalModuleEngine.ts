import type {
  ExecutionAuthorityLevel,
  ModuleExecutionQuestions,
  OutcomeVerificationStatus,
  UniversalNextActionState,
} from '@/types/moduleExecution';
import { persistActionReceipt } from '@/lib/mcp/actionReceipts';

export interface CrossModulePropagationEvent {
  tenantId: string;
  userId?: string;
  sourceModule: string;
  targetModule: string;
  entityId: string;
  entityType: string;
  action: string;
  payload: Record<string, unknown>;
  expectedOutcome: string;
}

/**
 * Determines execution authority level based on Reversibility x Consequence x Confidence
 */
export function determineAuthorityLevel(params: {
  isReversible: boolean;
  consequenceLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number; // 0 to 1
  hasExplicitPermission: boolean;
}): ExecutionAuthorityLevel {
  const { isReversible, consequenceLevel, confidenceScore, hasExplicitPermission } = params;

  if (consequenceLevel === 'critical' || !hasExplicitPermission) {
    return 'human_decision_required';
  }

  if (consequenceLevel === 'high' || confidenceScore < 0.7) {
    return 'approval_required';
  }

  if (consequenceLevel === 'medium' || !isReversible || confidenceScore < 0.9) {
    return 'automatic_logged';
  }

  return 'automatic';
}

/**
 * Builds standard UniversalNextActionState for any module record
 */
export function createNextActionState(params: {
  currentState: string;
  owner: string;
  nextAction: string;
  expectedOutcome: string;
  deadline?: string;
  blocker?: string;
  verifiedResult?: string;
  outcomeStatus?: OutcomeVerificationStatus;
  authorityLevel?: ExecutionAuthorityLevel;
}): UniversalNextActionState {
  return {
    currentState: params.currentState,
    owner: params.owner,
    nextAction: params.nextAction,
    deadline: params.deadline,
    blocker: params.blocker,
    expectedOutcome: params.expectedOutcome,
    verifiedResult: params.verifiedResult,
    outcomeStatus: params.outcomeStatus || 'pending',
    authorityLevel: params.authorityLevel || 'automatic_logged',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Executes closed-loop outcome verification and records action receipt
 */
export async function verifyAndRecordOutcome(params: {
  tenantId: string;
  userId?: string;
  moduleDomain: string;
  entityId: string;
  entityType: string;
  actionName: string;
  questions: ModuleExecutionQuestions;
  actualOutcome: string;
  isSuccessful: boolean;
}): Promise<{
  outcomeStatus: OutcomeVerificationStatus;
  nextActionState: UniversalNextActionState;
}> {
  const outcomeStatus: OutcomeVerificationStatus = params.isSuccessful ? 'verified' : 'failed';
  const nextAction = params.isSuccessful
    ? params.questions.whatHappensNext || 'Close record or retain knowledge'
    : `Follow up / retry failed action: ${params.questions.whatShouldHappen}`;

  const nextActionState: UniversalNextActionState = createNextActionState({
    currentState: params.isSuccessful ? 'Completed & Verified' : 'Blocked / Failed Verification',
    owner: params.questions.whoOwnsIt,
    nextAction,
    expectedOutcome: params.questions.whatShouldHappen,
    verifiedResult: params.actualOutcome,
    outcomeStatus,
    blocker: params.isSuccessful ? undefined : `Outcome verification failed: ${params.actualOutcome}`,
    authorityLevel: params.questions.canAlphaCloneAct,
  });

  // Persist receipt to MCP action receipts table for full auditability
  await persistActionReceipt({
    tenantId: params.tenantId,
    userId: params.userId,
    tool: `module_execution:${params.moduleDomain}`,
    receipt: {
      action_id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entity_id: params.entityId,
      entity_type: params.entityType,
      status: params.isSuccessful ? 'completed' : 'failed',
      timestamp: new Date().toISOString(),
      verification: {
        expected: params.questions.whatShouldHappen,
        actual: params.actualOutcome,
        verified_at: new Date().toISOString(),
        questions: params.questions,
      },
    },
    success: params.isSuccessful,
    sanitizedInput: { questions: params.questions },
    sanitizedOutput: { nextActionState },
  });

  return { outcomeStatus, nextActionState };
}

/**
 * Cross-module propagation helper to bridge disconnected business events
 */
export function buildPropagationChain(event: CrossModulePropagationEvent): {
  sourceModule: string;
  targetModule: string;
  suggestedAction: string;
  nextQuestions: Partial<ModuleExecutionQuestions>;
} {
  let suggestedAction = `Process ${event.action} from ${event.sourceModule}`;
  let targetModule = event.targetModule;

  if (event.sourceModule === 'email' && event.action === 'meeting_requested') {
    targetModule = 'calendar';
    suggestedAction = 'Schedule prep call and generate meeting record';
  } else if (event.sourceModule === 'meeting' && event.action === 'proposal_accepted') {
    targetModule = 'contracts';
    suggestedAction = 'Draft contract from accepted proposal';
  } else if (event.sourceModule === 'contracts' && event.action === 'contract_signed') {
    targetModule = 'projects';
    suggestedAction = 'Create project and milestone billing setup';
  } else if (event.sourceModule === 'projects' && event.action === 'milestone_completed') {
    targetModule = 'invoicing';
    suggestedAction = 'Generate and send milestone invoice';
  } else if (event.sourceModule === 'invoicing' && event.action === 'payment_received') {
    targetModule = 'money_hub';
    suggestedAction = 'Reconcile revenue and update client profitability metrics';
  }

  return {
    sourceModule: event.sourceModule,
    targetModule,
    suggestedAction,
    nextQuestions: {
      whatCameIn: `Event '${event.action}' from ${event.sourceModule}`,
      whatDoesItMean: `Trigger for ${targetModule} execution: ${event.expectedOutcome}`,
      whatShouldHappen: suggestedAction,
      whoOwnsIt: event.userId || 'system',
      canAlphaCloneAct: 'automatic_logged',
    },
  };
}
