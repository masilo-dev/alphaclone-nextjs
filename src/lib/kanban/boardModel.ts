/**
 * Core Domain Model for the Unified Enterprise Kanban Engine.
 * Powering CRM Deals, Leads, Workspace Tasks, Project Tasks, and Onboarding.
 */

export type BoardType = 
  | 'crm_deals' 
  | 'crm_leads' 
  | 'workspace_tasks' 
  | 'project_tasks' 
  | 'onboarding';

export type ClassOfService = 
  | 'expedite' 
  | 'fixed_date' 
  | 'standard' 
  | 'intangible';

export interface ColumnDefinition {
  id: string;
  title: string;
  color?: string;
  wipLimit?: number | null;
  isTerminal?: boolean;
  terminalType?: 'won' | 'lost' | 'completed' | 'cancelled' | 'abandoned';
  mandatoryReasonOnEntry?: boolean;
  requiredFields?: string[];
  allowedTransitions?: string[];
  rolePermissions?: string[];
  agingThresholdHours?: number;
}

export interface BoardDefinition {
  boardType: BoardType;
  title: string;
  description: string;
  cardUnitName: string;
  columns: ColumnDefinition[];
  defaultClassOfService: ClassOfService;
  terminalStates: string[];
  commitmentState?: string;
}

export interface BoardCardState {
  id: string;
  tenant_id: string;
  title: string;
  stage: string;
  owner_id?: string | null;
  entered_column_at: string;
  is_blocked: boolean;
  blocked_reason?: string | null;
  blocked_since?: string | null;
  unblock_owner_id?: string | null;
  class_of_service: ClassOfService;
  next_action?: string | null;
  next_action_date?: string | null;
  archived: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  value?: number | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BoardTransitionLog {
  id: string;
  tenant_id: string;
  board_type: BoardType;
  card_id: string;
  from_state: string | null;
  to_state: string;
  actor_id: string | null;
  reason: string | null;
  duration_in_previous_state_ms: number | null;
  is_override: boolean;
  override_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface BoardPolicy {
  id?: string;
  tenant_id: string;
  board_type: BoardType;
  column_id: string;
  wip_limit?: number | null;
  required_fields: string[];
  allowed_transitions: string[];
  role_permissions: string[];
  aging_threshold_hours?: number | null;
}

export interface TransitionRequest {
  tenantId: string;
  boardType: BoardType;
  cardId: string;
  targetState: string;
  actorId?: string | null;
  reason?: string;
  overrideWip?: boolean;
  overrideReason?: string;
  userRole?: string;
  cardUpdates?: {
    nextAction?: string;
    nextActionDate?: string;
    value?: number;
    notes?: string;
    blockedReason?: string;
    unblockOwnerId?: string;
    isBlocked?: boolean;
    classOfService?: ClassOfService;
    quoteId?: string;
    contractId?: string;
    checklistComplete?: boolean;
    evidenceRecordId?: string;
  };
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  errorCode?: 
    | 'INVALID_TRANSITION'
    | 'WIP_LIMIT_EXCEEDED'
    | 'MISSING_REQUIRED_FIELD'
    | 'PERMISSION_DENIED'
    | 'TERMINAL_STATE_LOCKED'
    | 'QUALIFICATION_EVIDENCE_MISSING'
    | 'CONTACT_SUPPRESSED'
    | 'NOT_FOUND'
    | 'TENANT_MISMATCH';
  transitionLog?: BoardTransitionLog;
  card?: BoardCardState;
}

export interface FlowMetricsResult {
  tenantId: string;
  boardType: BoardType;
  calculatedAt: string;
  summary: {
    wipCount: number;
    throughputCount: number; // in window
    avgCycleTimeDays: number;
    p50CycleTimeDays: number;
    p85CycleTimeDays: number;
    p95CycleTimeDays: number;
    avgLeadTimeDays: number;
    avgWorkItemAgeDays: number;
    totalBlockedTimeHours: number;
    flowEfficiencyPercent: number; // active / (active + wait/blocked)
  };
  agingAlerts: Array<{
    cardId: string;
    title: string;
    columnId: string;
    ageHours: number;
    thresholdHours: number;
    isBlocked: boolean;
    blockedReason?: string;
  }>;
  cumulativeFlowDiagram: Array<{
    date: string;
    countsByColumn: Record<string, number>;
  }>;
  cycleTimeScatterplot: Array<{
    cardId: string;
    completedAt: string;
    cycleTimeDays: number;
    leadTimeDays: number;
    classOfService: ClassOfService;
  }>;
}
