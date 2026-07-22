/**
 * Bonnie Agentic Business Operating System — shared types.
 * Bonnie is the intelligence that runs AlphaClone Systems.
 */

export type CognitiveStageName =
  | 'observe'
  | 'understand'
  | 'reason'
  | 'plan'
  | 'simulate'
  | 'evaluate_risk'
  | 'choose_strategy'
  | 'choose_agents'
  | 'choose_tools'
  | 'execute'
  | 'verify'
  | 'reflect'
  | 'learn'
  | 'update_memory'
  | 'improve'
  | 'continue_monitoring';

export type CognitiveStageStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export type CognitiveTriggerType =
  | 'instruction'
  | 'event'
  | 'cron'
  | 'approval_resume'
  | 'continuous';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type MemoryScope = 'organization' | 'user' | 'department' | 'short_term' | 'long_term';

export type DepartmentId =
  | 'executive'
  | 'operations'
  | 'sales'
  | 'crm'
  | 'marketing'
  | 'social'
  | 'finance'
  | 'accounting'
  | 'research'
  | 'communications'
  | 'calendar'
  | 'documents'
  | 'customer_success'
  | 'support'
  | 'compliance'
  | 'security'
  | 'reporting'
  | 'workflow'
  | 'automation'
  | 'knowledge'
  | 'supervision'
  | 'audit'
  | 'memory'
  | 'evaluation';

export type BonnieAgentDefinition = {
  id: string;
  name: string;
  department: DepartmentId;
  role: string;
  instructions: string;
  tools: string[];
  keywords: string[];
  writeAllowed?: boolean;
  priority?: number;
};

export type SupervisorDecision = {
  primaryAgentIds: string[];
  collaboratorAgentIds: string[];
  shouldStop: boolean;
  requiresApproval: boolean;
  shouldRetryStrategy: boolean;
  shouldUpdateMemory: boolean;
  shouldPromoteWorkflow: boolean;
  reasoning: string;
  confidence: number;
  strategy: string;
  riskLevel: RiskLevel;
};

export type CognitiveStageRecord = {
  name: CognitiveStageName;
  status: CognitiveStageStatus;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  evidence?: unknown[];
  confidence?: number;
  durationMs?: number;
};

export type CognitiveRunInput = {
  tenantId: string;
  userId?: string;
  goal: string;
  triggerType?: CognitiveTriggerType;
  triggerRef?: string;
  eventType?: string;
  eventPayload?: Record<string, unknown>;
  executeActions?: boolean;
  workflowId?: string;
};

export type CognitiveRunResult = {
  runId: string | null;
  status: 'completed' | 'awaiting_approval' | 'failed' | 'running';
  stages: CognitiveStageRecord[];
  selectedAgents: BonnieAgentDefinition[];
  selectedTools: string[];
  supervisor: SupervisorDecision;
  strategy: Record<string, unknown>;
  riskAssessment: Record<string, unknown>;
  confidence: number;
  evidence: unknown[];
  outcome: Record<string, unknown>;
  reflectionId?: string | null;
  twinSnapshotId?: string | null;
};

export type KnowledgeNodeInput = {
  entityType: string;
  entityId: string;
  label: string;
  properties?: Record<string, unknown>;
  confidence?: number;
};

export type KnowledgeEdgeInput = {
  fromEntityType: string;
  fromEntityId: string;
  toEntityType: string;
  toEntityId: string;
  relation: string;
  properties?: Record<string, unknown>;
  confidence?: number;
};

export type DigitalTwinSnapshot = {
  kpis: Record<string, number | string | null>;
  departments: Record<string, { status: string; signals: string[] }>;
  risks: Array<{ level: RiskLevel; title: string; evidence?: string }>;
  opportunities: Array<{ title: string; confidence: number }>;
  entityCounts: Record<string, number>;
  observedAt: string;
};

export type ReflectionResult = {
  whatWorked: string[];
  whatFailed: string[];
  lessons: string[];
  memoryUpdates: Array<{
    scope: MemoryScope;
    category: string;
    key: string;
    value: Record<string, unknown>;
    confidence?: number;
    department?: string;
  }>;
  workflowReuseCandidate: boolean;
  improvementActions: string[];
  confidence: number;
};
