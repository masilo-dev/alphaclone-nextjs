/** Universal Chaser — canonical types and lifecycle states. */

export const CHASE_STATES = [
  'DETECTED',
  'PLANNED',
  'WAITING_FOR_APPROVAL',
  'READY',
  'EXECUTING',
  'WAITING_FOR_OUTCOME',
  'RESOLVED',
  'SNOOZED',
  'ESCALATED',
  'EXHAUSTED',
  'CANCELLED',
] as const;

export type ChaseState = (typeof CHASE_STATES)[number];

export const TERMINAL_CHASE_STATES: ReadonlySet<ChaseState> = new Set([
  'RESOLVED',
  'EXHAUSTED',
  'CANCELLED',
]);

export const ACTIVE_CHASE_STATES: ReadonlySet<ChaseState> = new Set(
  CHASE_STATES.filter((s) => !TERMINAL_CHASE_STATES.has(s)),
);

export const CHASE_POLICY_KEYS = [
  'task_chaser',
  'project_chaser',
  'lead_chaser',
  'prospect_deal_chaser',
  'contact_chaser',
  'client_chaser',
  'quote_proposal_chaser',
  'contract_chaser',
  'invoice_chaser',
  'social_chaser',
  'campaign_chaser',
  'goal_chaser',
] as const;

export type ChasePolicyKey = (typeof CHASE_POLICY_KEYS)[number];

export type ChaseEntityType =
  | 'task'
  | 'project'
  | 'lead'
  | 'deal'
  | 'contact'
  | 'client'
  | 'quote'
  | 'proposal'
  | 'contract'
  | 'invoice'
  | 'social_account'
  | 'campaign'
  | 'goal';

export type ChaseAutomationMode = 'observe_only' | 'internal' | 'approval_required' | 'automated';

export type ChaseInstanceRow = {
  id: string;
  tenant_id: string;
  policy_key: ChasePolicyKey;
  entity_type: ChaseEntityType;
  entity_id: string;
  related_contact_id: string | null;
  related_client_id: string | null;
  related_project_id: string | null;
  related_task_id: string | null;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  state: ChaseState;
  severity: string;
  reason_code: string | null;
  waiting_on: string | null;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_action_at: string | null;
  last_observed_state: string | null;
  expected_outcome: string | null;
  terminal_outcome: string | null;
  channel: string | null;
  automation_mode: ChaseAutomationMode;
  approval_required: boolean;
  approval_id: string | null;
  idempotency_key: string;
  run_id: string | null;
  agent_task_id: string | null;
  snoozed_until: string | null;
  resolved_at: string | null;
  escalated_at: string | null;
  policy_snapshot: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
