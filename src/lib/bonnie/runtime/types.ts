/**
 * Bonnie Durable Runtime — shared types.
 */

export type TaskStatus =
  | 'DRAFT'
  | 'READY'
  | 'QUEUED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'WAITING_FOR_DEPENDENCY'
  | 'WAITING_FOR_EVENT'
  | 'WAITING_FOR_APPROVAL'
  | 'WAITING_FOR_USER'
  | 'RETRY_SCHEDULED'
  | 'PAUSED'
  | 'EXECUTION_UNCERTAIN'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED'
  | 'COMPENSATING'
  | 'ROLLED_BACK';

export type RunStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'completed'
  | 'completed_with_exceptions'
  | 'partially_completed'
  | 'failed'
  | 'cancelled'
  | 'cancellation_requested';

export type DependencyType =
  | 'finish_to_start'
  | 'all_completed'
  | 'any_completed'
  | 'succeeded'
  | 'data_produced'
  | 'approval'
  | 'event'
  | 'schedule'
  | 'condition';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ThinQueuePayload = {
  task_id: string;
  run_id: string;
  tenant_id: string;
  correlation_id?: string | null;
};

export type GraphTaskInput = {
  tempId: string;
  title: string;
  taskType?: string;
  assignedAgentId?: string;
  structuredInput?: Record<string, unknown>;
  expectedOutputSchema?: Record<string, unknown>;
  status?: TaskStatus;
  priority?: number;
  riskLevel?: RiskLevel;
  approvalPolicy?: Record<string, unknown>;
  retryPolicy?: Record<string, unknown>;
  timeoutPolicy?: Record<string, unknown>;
  verificationCriteria?: Record<string, unknown>;
  scheduledAt?: string | null;
  maxAttempts?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  parentTaskId?: string | null;
};

export type GraphDependencyInput = {
  taskTempId: string;
  dependsOnTempId: string;
  dependencyType?: DependencyType;
  condition?: Record<string, unknown>;
};

export type AgentTaskRow = {
  id: string;
  tenant_id: string;
  run_id: string;
  graph_id: string;
  status: TaskStatus;
  version: number;
  attempt_count: number;
  max_attempts: number;
  worker_id: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  structured_input: Record<string, unknown>;
  structured_output: Record<string, unknown>;
  assigned_agent_id: string | null;
  task_type: string;
  title: string;
  risk_level: RiskLevel;
  retry_policy: Record<string, unknown>;
  idempotency_key: string | null;
  correlation_id: string | null;
  failure_reason: string | null;
  scheduled_at: string | null;
};

export type AgentRunRow = {
  id: string;
  tenant_id: string;
  goal_id: string | null;
  user_id: string | null;
  title: string;
  description: string | null;
  status: RunStatus;
  progress_pct: number;
  correlation_id: string;
  success_criteria: Record<string, unknown>;
  execution_mode: string;
  metadata: Record<string, unknown>;
};

export function isDurableRuntimeEnabled(): boolean {
  return (
    process.env.BONNIE_DURABLE_RUNTIME === 'true' ||
    process.env.BONNIE_DURABLE_RUNTIME === '1'
  );
}
