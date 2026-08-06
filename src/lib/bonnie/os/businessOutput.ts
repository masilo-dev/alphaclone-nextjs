import type {
  AgentAuthorityRule,
  AgentPermissionLevel,
  BusinessExecutionAction,
  BusinessMetricEstimate,
  BusinessOutputSummary,
  BusinessPriorityRecommendation,
  BusinessPrioritySignal,
  ExpectedValueInput,
  ExpectedValueResult,
  ManagementByExceptionBrief,
  RequiresDecisionItem,
  RiskLevel,
  VerificationStatus,
} from './types';

const RISK_WEIGHT: Record<RiskLevel, number> = {
  low: 0.05,
  medium: 0.14,
  high: 0.28,
  critical: 0.45,
};

const PERMISSION_RISK: Record<AgentPermissionLevel, RiskLevel> = {
  read: 'low',
  prepare: 'low',
  write: 'medium',
  send: 'high',
  financial: 'high',
  admin: 'critical',
};

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function asMoney(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

export function calculateExpectedValue(input: ExpectedValueInput): ExpectedValueResult {
  const potentialValue = asMoney(input.potentialValue);
  const probability =
    typeof input.probability === 'number' && Number.isFinite(input.probability)
      ? clampProbability(input.probability)
      : null;
  const executionCost = Math.max(0, asMoney(input.executionCost) ?? 0);
  const riskAdjustment = Math.max(0, asMoney(input.riskAdjustment) ?? 0);
  const currency = input.currency || 'USD';

  if (potentialValue == null || probability == null) {
    return {
      status: 'insufficient_data',
      expectedValue: null,
      potentialValue,
      probability,
      executionCost,
      riskAdjustment,
      currency,
      explanation:
        'Insufficient data: potential value and probability are required before AlphaClone can calculate expected value.',
    };
  }

  const expectedValue = potentialValue * probability - executionCost - riskAdjustment;

  return {
    status: 'calculated',
    expectedValue,
    potentialValue,
    probability,
    executionCost,
    riskAdjustment,
    currency,
    explanation:
      `Expected Value = ${potentialValue} x ${(probability * 100).toFixed(0)}% - ${executionCost} - ${riskAdjustment}.`,
  };
}

export function riskAdjustmentFromValue(value: number | null | undefined, risk: RiskLevel): number {
  const base = asMoney(value) ?? 0;
  return Math.round(base * RISK_WEIGHT[risk] * 100) / 100;
}

export function authorityRequiresApproval(
  permissionLevel: AgentPermissionLevel,
  rules: AgentAuthorityRule[] = [],
  opts: { spendAmount?: number; discountPercent?: number } = {},
): { required: boolean; reason: string } {
  const explicit = rules.find((rule) => rule.permission === permissionLevel);
  if (!explicit) {
    const defaultRisk = PERMISSION_RISK[permissionLevel];
    return {
      required: defaultRisk === 'high' || defaultRisk === 'critical',
      reason:
        defaultRisk === 'high' || defaultRisk === 'critical'
          ? `${permissionLevel} actions require approval by default.`
          : `${permissionLevel} actions are allowed by default policy.`,
    };
  }

  if (!explicit.allowed) {
    return { required: true, reason: explicit.reason || `${permissionLevel} is denied by authority policy.` };
  }

  if (explicit.requiresApproval) {
    return { required: true, reason: explicit.reason || `${permissionLevel} requires approval by authority policy.` };
  }

  if (typeof explicit.maxSpend === 'number' && typeof opts.spendAmount === 'number' && opts.spendAmount > explicit.maxSpend) {
    return { required: true, reason: `Spend ${opts.spendAmount} exceeds autonomous limit ${explicit.maxSpend}.` };
  }

  if (
    typeof explicit.maxDiscountPercent === 'number' &&
    typeof opts.discountPercent === 'number' &&
    opts.discountPercent > explicit.maxDiscountPercent
  ) {
    return {
      required: true,
      reason: `Discount ${opts.discountPercent}% exceeds autonomous limit ${explicit.maxDiscountPercent}%.`,
    };
  }

  return { required: false, reason: explicit.reason || `${permissionLevel} is allowed within authority policy.` };
}

export function createExecutionAction(params: {
  id: string;
  title: string;
  objective: string;
  agentId?: string;
  toolName?: string;
  permissionLevel: AgentPermissionLevel;
  riskLevel?: RiskLevel;
  potentialValue?: number | null;
  probability?: number | null;
  estimatedCost?: BusinessMetricEstimate;
  expectedOutcome?: string;
  authorityRules?: AgentAuthorityRule[];
  spendAmount?: number;
  discountPercent?: number;
  evidence?: unknown[];
  now?: string;
}): BusinessExecutionAction {
  const riskLevel = params.riskLevel || PERMISSION_RISK[params.permissionLevel];
  const approval = authorityRequiresApproval(params.permissionLevel, params.authorityRules, {
    spendAmount: params.spendAmount,
    discountPercent: params.discountPercent,
  });
  const executionCost = params.estimatedCost?.unit === 'money' ? params.estimatedCost.value : params.spendAmount;
  const expectedValue = calculateExpectedValue({
    potentialValue: params.potentialValue,
    probability: params.probability,
    executionCost,
    riskAdjustment: riskAdjustmentFromValue(params.potentialValue, riskLevel),
    currency: params.estimatedCost?.currency,
  });

  return {
    id: params.id,
    title: params.title,
    objective: params.objective,
    agentId: params.agentId,
    toolName: params.toolName,
    permissionLevel: params.permissionLevel,
    riskLevel,
    estimatedCost: params.estimatedCost,
    expectedOutcome: params.expectedOutcome,
    expectedValue,
    requiredApproval: approval.required,
    status: approval.required ? 'awaiting_approval' : 'suggested',
    verificationStatus: 'not_started',
    evidence: [
      ...(params.evidence || []),
      { type: 'authority_decision', reason: approval.reason },
    ],
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function riskPenalty(risk: RiskLevel): number {
  if (risk === 'critical') return 45;
  if (risk === 'high') return 25;
  if (risk === 'medium') return 10;
  return 0;
}

export function rankBusinessPriorities(signals: BusinessPrioritySignal[]): BusinessPriorityRecommendation[] {
  return signals
    .map((signal) => {
      const risk = signal.risk || 'low';
      const expectedValue = calculateExpectedValue({
        potentialValue: signal.potentialValue,
        probability: signal.probability,
        executionCost: signal.executionCost,
        riskAdjustment: signal.riskAdjustment ?? riskAdjustmentFromValue(signal.potentialValue, risk),
        currency: signal.currency,
      });
      const valueScore = expectedValue.expectedValue == null ? 0 : Math.max(-100, Math.min(100, expectedValue.expectedValue / 100));
      const urgencyScore = (signal.urgency ?? 0.5) * 20;
      const strategicScore = (signal.strategicRelevance ?? 0.5) * 12;
      const customerScore = (signal.customerImportance ?? 0.5) * 10;
      const effortPenalty = (signal.effort ?? 0.5) * 10;
      const priorityScore = Math.round(
        valueScore + urgencyScore + strategicScore + customerScore - effortPenalty - riskPenalty(risk),
      );
      const recommended =
        expectedValue.status === 'insufficient_data'
          ? 'wait_for_evidence'
          : signal.requiresApproval
            ? 'prepare_for_approval'
            : priorityScore > 0
              ? 'execute'
              : 'monitor';

      return {
        ...signal,
        expectedValue,
        priorityScore,
        recommended,
        reason:
          expectedValue.status === 'insufficient_data'
            ? 'AlphaClone needs defensible value and probability data before recommending execution.'
            : `Ranked by expected value, urgency, effort, risk, customer importance and strategic relevance.`,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function buildManagementByExceptionBrief(params: {
  actions: BusinessExecutionAction[];
  routineActionsHandled?: number;
  output?: Partial<BusinessOutputSummary>;
}): ManagementByExceptionBrief {
  const decisions: RequiresDecisionItem[] = params.actions
    .filter((action) => action.requiredApproval || action.status === 'awaiting_approval' || action.riskLevel === 'high' || action.riskLevel === 'critical')
    .map((action) => ({
      id: action.id,
      title: action.title,
      reason: action.expectedValue?.explanation || action.expectedOutcome || 'Decision required before execution.',
      value:
        action.expectedValue?.expectedValue == null
          ? undefined
          : {
              value: action.expectedValue.expectedValue,
              currency: action.expectedValue.currency,
              unit: 'money',
              attribution: action.expectedValue.status === 'calculated' ? 'estimated' : 'unknown',
            },
      recommendedAction: action.requiredApproval ? 'Review and approve or reject.' : 'Review risk before execution.',
      riskLevel: action.riskLevel,
      approvalRequired: action.requiredApproval,
    }));

  const failedActions = params.actions.filter((action) => action.status === 'failed').length;
  const successfulActions = params.actions.filter((action) => action.status === 'completed').length;
  const humanInterventions = decisions.length;
  const output: BusinessOutputSummary = {
    successfulActions,
    failedActions,
    humanInterventions,
    ...params.output,
  };

  return {
    headline:
      decisions.length === 0
        ? 'Your business has no high-priority decisions waiting.'
        : `Your business requires ${decisions.length} decision${decisions.length === 1 ? '' : 's'} today.`,
    decisions,
    routineActionsHandled: params.routineActionsHandled ?? Math.max(0, params.actions.length - decisions.length),
    output,
  };
}

export function verificationStatusFromOutcome(action: Pick<BusinessExecutionAction, 'status'>): VerificationStatus {
  if (action.status === 'completed') return 'verified';
  if (action.status === 'failed') return 'failed';
  if (action.status === 'cancelled') return 'not_verifiable';
  return 'pending';
}
