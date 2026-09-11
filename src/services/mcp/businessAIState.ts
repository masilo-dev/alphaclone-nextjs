export type BusinessAIDomain =
  | 'crm'
  | 'finance'
  | 'contracts'
  | 'marketing'
  | 'support'
  | 'operations'
  | 'strategy';

export type BusinessAIModelPreference = 'claude' | 'openai' | 'hybrid' | 'auto';

export type BusinessAIAgentMode = 'observe' | 'draft' | 'act_with_approval' | 'autonomous';

export interface BusinessAIScores {
  auditability: number;
  workflow_fit: number;
  data_quality: number;
  human_review_coverage: number;
  integration_depth: number;
  model_confidence: number;
  compliance: number;
}

export interface BusinessAIComplianceState {
  dpa_ok: boolean;
  retention_ok: boolean;
  sso_ok: boolean;
  pii_rules_ok: boolean;
}

export interface BusinessAIAuditState {
  evidence_required: boolean;
  record_decisions: boolean;
  human_review_actions: string[];
}

export interface BusinessAIThresholds {
  draft_max: number;
  act_with_approval_min: number;
  autonomous_min: number;
}

export interface BusinessAIOwnerProfile {
  owner_type: 'solo' | 'small_team' | 'scaling_team';
  weekly_capacity_hours: number;
  admin_load: 'low' | 'medium' | 'high';
  primary_constraint: 'time' | 'cash_flow' | 'leads' | 'delivery' | 'focus';
  value_add_focus: string[];
}

export interface BusinessAIState {
  version: 1;
  primary_domain: BusinessAIDomain;
  secondary_domains: BusinessAIDomain[];
  agent_mode: BusinessAIAgentMode;
  preferred_model: BusinessAIModelPreference;
  preferred_model_by_task: Partial<Record<string, BusinessAIModelPreference>>;
  audit: BusinessAIAuditState;
  compliance: BusinessAIComplianceState;
  scores: BusinessAIScores;
  thresholds: BusinessAIThresholds;
  owner_profile: BusinessAIOwnerProfile;
  memory_summary: string;
  kpi_targets: string[];
  last_policy_review_at: string | null;
}

export interface BusinessAIEvaluationContext {
  task?: string;
  task_category?: string;
  touches_sensitive_data?: boolean;
  requires_external_action?: boolean;
  requires_financial_action?: boolean;
  requires_legal_action?: boolean;
  requires_customer_facing_action?: boolean;
}

export interface BusinessAIEvaluation {
  readiness_score: number;
  recommended_mode: BusinessAIAgentMode;
  recommended_model: BusinessAIModelPreference;
  human_review_required: boolean;
  reasons: string[];
  risk_flags: string[];
  score_breakdown: BusinessAIScores;
}

const DEFAULT_SCORES: BusinessAIScores = {
  auditability: 84,
  workflow_fit: 78,
  data_quality: 74,
  human_review_coverage: 82,
  integration_depth: 70,
  model_confidence: 80,
  compliance: 88,
};

export const DEFAULT_BUSINESS_AI_STATE: BusinessAIState = {
  version: 1,
  primary_domain: 'operations',
  secondary_domains: ['crm', 'finance', 'marketing'],
  agent_mode: 'act_with_approval',
  preferred_model: 'claude',
  preferred_model_by_task: {
    research: 'claude',
    drafting: 'claude',
    analysis: 'claude',
    audit: 'claude',
    execution: 'hybrid',
  },
  audit: {
    evidence_required: true,
    record_decisions: true,
    human_review_actions: process.env.MCP_AUTO_EXECUTE === 'true'
      ? []
      : ['send_invoice', 'send_transactional_email', 'send_whatsapp_message', 'update_contract_status'],
  },
  compliance: {
    dpa_ok: true,
    retention_ok: true,
    sso_ok: true,
    pii_rules_ok: true,
  },
  scores: DEFAULT_SCORES,
  thresholds: {
    draft_max: 54,
    act_with_approval_min: 72,
    autonomous_min: 88,
  },
  owner_profile: {
    owner_type: 'solo',
    weekly_capacity_hours: 25,
    admin_load: 'high',
    primary_constraint: 'time',
    value_add_focus: [
      'save owner time',
      'recover revenue faster',
      'turn conversations into booked work',
      'reduce admin switching',
    ],
  },
  memory_summary:
    'Claude is the business co-worker for research, drafting, audit, and controlled execution. High-risk actions should default to review, not autopilot.',
  kpi_targets: [
    'shorten time to decision',
    'reduce manual back-and-forth',
    'increase audit coverage',
    'raise workflow automation rate',
    'keep human review on high-risk actions',
  ],
  last_policy_review_at: null,
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeScores(scores: Partial<BusinessAIScores> | undefined): BusinessAIScores {
  const input = scores || {};
  return {
    auditability: clamp(Number(input.auditability ?? DEFAULT_SCORES.auditability), 0, 100),
    workflow_fit: clamp(Number(input.workflow_fit ?? DEFAULT_SCORES.workflow_fit), 0, 100),
    data_quality: clamp(Number(input.data_quality ?? DEFAULT_SCORES.data_quality), 0, 100),
    human_review_coverage: clamp(Number(input.human_review_coverage ?? DEFAULT_SCORES.human_review_coverage), 0, 100),
    integration_depth: clamp(Number(input.integration_depth ?? DEFAULT_SCORES.integration_depth), 0, 100),
    model_confidence: clamp(Number(input.model_confidence ?? DEFAULT_SCORES.model_confidence), 0, 100),
    compliance: clamp(Number(input.compliance ?? DEFAULT_SCORES.compliance), 0, 100),
  };
}

function normalizeCompliance(value: Partial<BusinessAIComplianceState> | undefined): BusinessAIComplianceState {
  const input = value || {};
  return {
    dpa_ok: input.dpa_ok ?? DEFAULT_BUSINESS_AI_STATE.compliance.dpa_ok,
    retention_ok: input.retention_ok ?? DEFAULT_BUSINESS_AI_STATE.compliance.retention_ok,
    sso_ok: input.sso_ok ?? DEFAULT_BUSINESS_AI_STATE.compliance.sso_ok,
    pii_rules_ok: input.pii_rules_ok ?? DEFAULT_BUSINESS_AI_STATE.compliance.pii_rules_ok,
  };
}

function normalizeAudit(value: Partial<BusinessAIAuditState> | undefined): BusinessAIAuditState {
  const input = value || {};
  const defaultActions = process.env.MCP_AUTO_EXECUTE === 'true'
    ? []
    : ['send_invoice', 'send_transactional_email', 'send_whatsapp_message', 'update_contract_status'];
  return {
    evidence_required: input.evidence_required ?? DEFAULT_BUSINESS_AI_STATE.audit.evidence_required,
    record_decisions: input.record_decisions ?? DEFAULT_BUSINESS_AI_STATE.audit.record_decisions,
    human_review_actions: normalizeStringArray(input.human_review_actions).length
      ? normalizeStringArray(input.human_review_actions)
      : [...defaultActions],
  };
}

function normalizeThresholds(value: Partial<BusinessAIThresholds> | undefined): BusinessAIThresholds {
  const input = value || {};
  return {
    draft_max: clamp(Number(input.draft_max ?? DEFAULT_BUSINESS_AI_STATE.thresholds.draft_max), 0, 100),
    act_with_approval_min: clamp(Number(input.act_with_approval_min ?? DEFAULT_BUSINESS_AI_STATE.thresholds.act_with_approval_min), 0, 100),
    autonomous_min: clamp(Number(input.autonomous_min ?? DEFAULT_BUSINESS_AI_STATE.thresholds.autonomous_min), 0, 100),
  };
}

function normalizeOwnerProfile(value: Partial<BusinessAIOwnerProfile> | undefined): BusinessAIOwnerProfile {
  const input = value || {};
  return {
    owner_type: input.owner_type || DEFAULT_BUSINESS_AI_STATE.owner_profile.owner_type,
    weekly_capacity_hours: clamp(
      Number(input.weekly_capacity_hours ?? DEFAULT_BUSINESS_AI_STATE.owner_profile.weekly_capacity_hours),
      1,
      168
    ),
    admin_load: input.admin_load || DEFAULT_BUSINESS_AI_STATE.owner_profile.admin_load,
    primary_constraint: input.primary_constraint || DEFAULT_BUSINESS_AI_STATE.owner_profile.primary_constraint,
    value_add_focus: normalizeStringArray(input.value_add_focus).length
      ? normalizeStringArray(input.value_add_focus)
      : [...DEFAULT_BUSINESS_AI_STATE.owner_profile.value_add_focus],
  };
}

export function normalizeBusinessAIState(state?: Partial<BusinessAIState> | null): BusinessAIState {
  const input = state || {};
  return {
    version: 1,
    primary_domain: (input.primary_domain as BusinessAIDomain) || DEFAULT_BUSINESS_AI_STATE.primary_domain,
    secondary_domains: normalizeStringArray(input.secondary_domains) as BusinessAIDomain[],
    agent_mode: (input.agent_mode as BusinessAIAgentMode) || DEFAULT_BUSINESS_AI_STATE.agent_mode,
    preferred_model: (input.preferred_model as BusinessAIModelPreference) || DEFAULT_BUSINESS_AI_STATE.preferred_model,
    preferred_model_by_task: {
      ...DEFAULT_BUSINESS_AI_STATE.preferred_model_by_task,
      ...(input.preferred_model_by_task || {}),
    },
    audit: normalizeAudit(input.audit),
    compliance: normalizeCompliance(input.compliance),
    scores: normalizeScores(input.scores),
    thresholds: normalizeThresholds(input.thresholds),
    owner_profile: normalizeOwnerProfile(input.owner_profile),
    memory_summary: typeof input.memory_summary === 'string' && input.memory_summary.trim()
      ? input.memory_summary.trim()
      : DEFAULT_BUSINESS_AI_STATE.memory_summary,
    kpi_targets: normalizeStringArray(input.kpi_targets).length
      ? normalizeStringArray(input.kpi_targets)
      : [...DEFAULT_BUSINESS_AI_STATE.kpi_targets],
    last_policy_review_at: typeof input.last_policy_review_at === 'string' && input.last_policy_review_at.trim()
      ? input.last_policy_review_at.trim()
      : null,
  };
}

export function mergeBusinessAIState(
  existing: Partial<BusinessAIState> | null | undefined,
  patch: Partial<BusinessAIState>
): BusinessAIState {
  const base = normalizeBusinessAIState(existing);
  const next = normalizeBusinessAIState({
    ...base,
    ...patch,
    audit: {
      ...base.audit,
      ...(patch.audit || {}),
    },
    compliance: {
      ...base.compliance,
      ...(patch.compliance || {}),
    },
    scores: {
      ...base.scores,
      ...(patch.scores || {}),
    },
    thresholds: {
      ...base.thresholds,
      ...(patch.thresholds || {}),
    },
    owner_profile: {
      ...base.owner_profile,
      ...(patch.owner_profile || {}),
    },
    preferred_model_by_task: {
      ...base.preferred_model_by_task,
      ...(patch.preferred_model_by_task || {}),
    },
  });
  return next;
}

function averageScore(scores: BusinessAIScores): number {
  const values = Object.values(scores);
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

export function evaluateBusinessAIState(
  state: BusinessAIState,
  context: BusinessAIEvaluationContext = {}
): BusinessAIEvaluation {
  const scoreBreakdown = normalizeScores(state.scores);
  const weightedScore = Math.round(
    (scoreBreakdown.auditability * 0.2) +
    (scoreBreakdown.workflow_fit * 0.2) +
    (scoreBreakdown.data_quality * 0.15) +
    (scoreBreakdown.human_review_coverage * 0.15) +
    (scoreBreakdown.integration_depth * 0.15) +
    (scoreBreakdown.model_confidence * 0.1) +
    (scoreBreakdown.compliance * 0.05)
  );

  const riskFlags: string[] = [];
  const reasons: string[] = [];
  const taskText = `${context.task || ''} ${context.task_category || ''}`.toLowerCase();
  const touchesSensitiveData = !!context.touches_sensitive_data;
  const requiresExternalAction = !!context.requires_external_action;
  const requiresFinancialAction = !!context.requires_financial_action;
  const requiresLegalAction = !!context.requires_legal_action;
  const requiresCustomerFacingAction = !!context.requires_customer_facing_action;

  if (touchesSensitiveData) riskFlags.push('sensitive_data');
  if (requiresExternalAction) riskFlags.push('external_action');
  if (requiresFinancialAction) riskFlags.push('financial_action');
  if (requiresLegalAction) riskFlags.push('legal_action');
  if (requiresCustomerFacingAction) riskFlags.push('customer_facing_action');

  const hasResearchOrAuditSignal =
    taskText.includes('research') ||
    taskText.includes('audit') ||
    taskText.includes('review') ||
    taskText.includes('analysis') ||
    taskText.includes('document') ||
    taskText.includes('strategy');

  const taskModel: BusinessAIModelPreference =
    context.task_category && state.preferred_model_by_task[context.task_category]
      ? (state.preferred_model_by_task[context.task_category] || state.preferred_model)
      : hasResearchOrAuditSignal
        ? 'claude'
        : (requiresExternalAction || requiresFinancialAction)
          ? 'hybrid'
          : state.preferred_model;

  const highRisk = touchesSensitiveData || requiresFinancialAction || requiresLegalAction || requiresCustomerFacingAction;

  let recommended_mode: BusinessAIAgentMode = 'observe';
  if (weightedScore >= state.thresholds.autonomous_min && !highRisk && !requiresExternalAction) {
    recommended_mode = 'autonomous';
    reasons.push('The current state is strong enough for limited autonomous execution.');
  } else if (weightedScore >= state.thresholds.act_with_approval_min) {
    recommended_mode = 'act_with_approval';
    reasons.push('The workflow is strong, but the system should keep human approval in the loop.');
  } else if (weightedScore >= state.thresholds.draft_max) {
    recommended_mode = 'draft';
    reasons.push('The workflow can draft work, but a human should review before action.');
  } else {
    recommended_mode = 'observe';
    reasons.push('The current readiness is too low for direct action. Use the system for observation and planning first.');
  }

  if (highRisk) {
    recommended_mode = recommended_mode === 'autonomous' ? 'act_with_approval' : recommended_mode;
    reasons.push('The task touches sensitive or high-impact business work, so review is recommended.');
  }

  if (taskModel === 'claude') {
    reasons.push('Claude is the best fit for reasoning, research, drafting, and audit-friendly synthesis.');
  } else if (taskModel === 'hybrid') {
    reasons.push('Hybrid execution fits best because the task needs both reasoning and external action.');
  }

  if (state.audit.evidence_required) {
    reasons.push('Evidence capture is enabled, which supports auditability and defensibility.');
  }

  if (state.owner_profile.owner_type === 'solo') {
    reasons.push('Solo-owner mode is active, so the system should protect owner time and reduce admin switching.');
  }

  const human_review_required =
    recommended_mode !== 'autonomous' ||
    highRisk ||
    state.audit.human_review_actions.length > 0;

  return {
    readiness_score: weightedScore,
    recommended_mode,
    recommended_model: taskModel,
    human_review_required,
    reasons,
    risk_flags: riskFlags,
    score_breakdown: scoreBreakdown,
  };
}

export function summarizeBusinessAIState(state: BusinessAIState): Record<string, unknown> {
  const normalized = normalizeBusinessAIState(state);
  const readiness = averageScore(normalized.scores);
  const evaluation = evaluateBusinessAIState(normalized);

  return {
    version: normalized.version,
    primary_domain: normalized.primary_domain,
    secondary_domains: normalized.secondary_domains,
    agent_mode: normalized.agent_mode,
    preferred_model: normalized.preferred_model,
    kpi_targets: normalized.kpi_targets,
    audit: normalized.audit,
    compliance: normalized.compliance,
    owner_profile: normalized.owner_profile,
    scores: normalized.scores,
    readiness_score: evaluation.readiness_score || readiness,
    recommended_mode: evaluation.recommended_mode,
    recommended_model: evaluation.recommended_model,
    human_review_required: evaluation.human_review_required,
    risk_flags: evaluation.risk_flags,
    reasons: evaluation.reasons,
    memory_summary: normalized.memory_summary,
    last_policy_review_at: normalized.last_policy_review_at,
  };
}
