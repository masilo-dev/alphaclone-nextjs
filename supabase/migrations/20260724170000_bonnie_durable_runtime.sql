-- Bonnie Durable Execution Foundation
-- Postgres is the sole source of truth for runs, graphs, tasks, outbox/inbox, leases, checkpoints, timers.

BEGIN;

-- ─── Runs ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID NULL,
  goal_id UUID NULL REFERENCES public.bonnie_goals(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  conversation_id UUID NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  success_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_mode TEXT NOT NULL DEFAULT 'approval_required'
    CHECK (execution_mode IN (
      'ask_only', 'plan_only', 'approval_required', 'semi_autonomous', 'fully_autonomous'
    )),
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'planning', 'running', 'waiting', 'blocked',
      'completed', 'completed_with_exceptions', 'partially_completed',
      'failed', 'cancelled', 'cancellation_requested'
    )),
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  failure_reason TEXT NULL,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NULL,
  last_progress_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_status
  ON public.agent_runs (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_goal
  ON public.agent_runs (goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_correlation
  ON public.agent_runs (correlation_id);

-- ─── Graphs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  current_version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'superseded', 'completed', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_graphs_run
  ON public.agent_graphs (run_id);

CREATE TABLE IF NOT EXISTS public.agent_graph_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  graph_id UUID NOT NULL REFERENCES public.agent_graphs(id) ON DELETE CASCADE,
  version INT NOT NULL,
  reason TEXT NULL,
  actor_type TEXT NULL,
  actor_id TEXT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (graph_id, version)
);

-- ─── Tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID NULL,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  graph_id UUID NOT NULL REFERENCES public.agent_graphs(id) ON DELETE CASCADE,
  graph_version INT NOT NULL DEFAULT 1,
  parent_task_id UUID NULL REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  assigned_agent_id TEXT NULL,
  task_type TEXT NOT NULL DEFAULT 'generic',
  title TEXT NOT NULL,
  structured_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  structured_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'READY', 'QUEUED', 'CLAIMED', 'RUNNING',
      'WAITING_FOR_DEPENDENCY', 'WAITING_FOR_EVENT', 'WAITING_FOR_APPROVAL',
      'WAITING_FOR_USER', 'RETRY_SCHEDULED', 'PAUSED',
      'EXECUTION_UNCERTAIN',
      'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED',
      'COMPENSATING', 'ROLLED_BACK'
    )),
  priority INT NOT NULL DEFAULT 3,
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  approval_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_policy JSONB NOT NULL DEFAULT '{"maxAttempts":3,"backoffMs":60000}'::jsonb,
  timeout_policy JSONB NOT NULL DEFAULT '{"executionMs":300000}'::jsonb,
  verification_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  idempotency_key TEXT NULL,
  worker_id TEXT NULL,
  lease_token TEXT NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  last_heartbeat_at TIMESTAMPTZ NULL,
  claimed_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  correlation_id UUID NULL,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status
  ON public.agent_tasks (tenant_id, status, scheduled_at NULLS FIRST, priority, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_lease
  ON public.agent_tasks (lease_expires_at)
  WHERE status IN ('CLAIMED', 'RUNNING') AND lease_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_run
  ON public.agent_tasks (run_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_idempotency
  ON public.agent_tasks (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_correlation
  ON public.agent_tasks (correlation_id);

CREATE TABLE IF NOT EXISTS public.agent_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type IN (
      'finish_to_start', 'all_completed', 'any_completed', 'succeeded',
      'data_produced', 'approval', 'event', 'schedule', 'condition'
    )),
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, depends_on_task_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_task_deps_depends
  ON public.agent_task_dependencies (depends_on_task_id);

CREATE TABLE IF NOT EXISTS public.agent_task_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  worker_id TEXT NULL,
  lease_token TEXT NULL,
  fencing_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN (
      'running', 'completed', 'failed', 'abandoned', 'uncertain', 'cancelled'
    )),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_category TEXT NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  retryable BOOLEAN NULL,
  next_retry_at TIMESTAMPTZ NULL,
  provider_reference TEXT NULL,
  checkpoint_id UUID NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (task_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_agent_task_attempts_task
  ON public.agent_task_attempts (task_id, attempt_number DESC);

CREATE TABLE IF NOT EXISTS public.agent_task_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.agent_task_attempts(id) ON DELETE CASCADE,
  sequence INT NOT NULL,
  completed_stage TEXT NOT NULL,
  intermediate_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  remaining_work JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_references JSONB NOT NULL DEFAULT '{}'::jsonb,
  cursor_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  resume_token TEXT NULL,
  checkpoint_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.agent_worker_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  attempt_id UUID NULL REFERENCES public.agent_task_attempts(id) ON DELETE SET NULL,
  worker_id TEXT NOT NULL,
  lease_token TEXT NOT NULL,
  fencing_token TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'expired', 'stolen')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_worker_leases_active
  ON public.agent_worker_leases (expires_at)
  WHERE status = 'active';

-- ─── Tool / idempotency ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  task_id UUID NULL REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  attempt_id UUID NULL,
  action_type TEXT NOT NULL,
  request_fingerprint TEXT NULL,
  state TEXT NOT NULL DEFAULT 'started'
    CHECK (state IN ('started', 'running', 'completed', 'failed', 'uncertain')),
  external_provider_reference TEXT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  failure_state JSONB NULL,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  attempt_id UUID NULL REFERENCES public.agent_task_attempts(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  idempotency_key TEXT NULL,
  fencing_token TEXT NULL,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'failed', 'uncertain', 'skipped')),
  args JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_reference TEXT NULL,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_task
  ON public.agent_tool_executions (task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tool_executions_idem
  ON public.agent_tool_executions (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agent_external_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NULL REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  attempt_id UUID NULL,
  tool_execution_id UUID NULL REFERENCES public.agent_tool_executions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, reference_type, reference_id)
);

-- ─── Events: inbox / outbox / subscriptions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_event_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID NULL,
  provider_event_id TEXT NULL,
  event_type TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  authenticity JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  correlation_id UUID NULL,
  UNIQUE (tenant_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_event_inbox_status
  ON public.agent_event_inbox (tenant_id, processing_status, received_at);

CREATE TABLE IF NOT EXISTS public.agent_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'delivering', 'delivered', 'failed', 'dead_letter')),
  delivery_attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT NULL,
  locked_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  delivered_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_event_outbox_delivery
  ON public.agent_event_outbox (delivery_status, next_attempt_at)
  WHERE delivery_status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS public.agent_event_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID NULL,
  waiting_task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  match_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'satisfied', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NULL,
  timeout_behavior JSONB NOT NULL DEFAULT '{"action":"escalate"}'::jsonb,
  satisfied_at TIMESTAMPTZ NULL,
  satisfied_by_event_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_event_subs_match
  ON public.agent_event_subscriptions (tenant_id, event_type, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agent_event_subs_task
  ON public.agent_event_subscriptions (waiting_task_id);

-- ─── Timers / approvals / interventions / audit ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  run_id UUID NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  execute_at TIMESTAMPTZ NOT NULL,
  tenant_timezone TEXT NOT NULL DEFAULT 'UTC',
  timer_type TEXT NOT NULL DEFAULT 'delay'
    CHECK (timer_type IN ('delay', 'schedule', 'retry', 'approval_expiry', 'escalation', 'business_day')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'fired', 'cancelled', 'failed')),
  claimed_by TEXT NULL,
  claim_expires_at TIMESTAMPTZ NULL,
  fired_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_timers_due
  ON public.agent_timers (status, execute_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  runner_approval_id UUID NULL,
  proposed_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_fingerprint TEXT NOT NULL,
  data_version TEXT NOT NULL,
  requested_approver UUID NULL,
  required_role TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'approved', 'rejected', 'expired', 'invalidated', 'executed'
    )),
  expires_at TIMESTAMPTZ NULL,
  decision_maker UUID NULL,
  decision_at TIMESTAMPTZ NULL,
  decision_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_pending
  ON public.agent_approvals (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id UUID NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  task_id UUID NULL REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN (
      'approval_required', 'missing_information', 'permission_blocked',
      'integration_disconnected', 'conflicting_data', 'agent_uncertainty',
      'retry_limit_reached', 'policy_violation', 'deadline_approaching',
      'dead_letter', 'execution_uncertain', 'manual_takeover'
    )),
  title TEXT NOT NULL,
  detail TEXT NULL,
  suggested_resolution TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  attempt_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_checkpoint JSONB NULL,
  resolved_by UUID NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_interventions_open
  ON public.agent_interventions (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  previous_state TEXT NULL,
  new_state TEXT NOT NULL,
  trigger TEXT NOT NULL,
  actor_type TEXT NULL,
  actor_id TEXT NULL,
  reason TEXT NULL,
  related_event_id UUID NULL,
  related_attempt_id UUID NULL,
  expected_version INT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_state_transitions_entity
  ON public.agent_state_transitions (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NULL,
  reconciler TEXT NOT NULL,
  repaired_count INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_reconciliation_logs_created
  ON public.agent_reconciliation_logs (created_at DESC);

-- ─── Transactional graph create RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_agent_graph_transaction(
  p_tenant_id UUID,
  p_run_id UUID,
  p_tasks JSONB,
  p_dependencies JSONB DEFAULT '[]'::jsonb,
  p_reason TEXT DEFAULT 'initial_plan',
  p_actor_type TEXT DEFAULT 'planner',
  p_actor_id TEXT DEFAULT 'executive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_graph_id UUID;
  v_version INT := 1;
  v_task JSONB;
  v_dep JSONB;
  v_task_id UUID;
  v_task_ids UUID[] := ARRAY[]::UUID[];
  v_id_map JSONB := '{}'::jsonb;
  v_temp_id TEXT;
  v_real_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM agent_runs WHERE id = p_run_id AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'run not found for tenant';
  END IF;

  INSERT INTO agent_graphs (tenant_id, run_id, current_version, status)
  VALUES (p_tenant_id, p_run_id, 1, 'active')
  RETURNING id INTO v_graph_id;

  INSERT INTO agent_graph_versions (tenant_id, graph_id, version, reason, actor_type, actor_id, snapshot)
  VALUES (
    p_tenant_id, v_graph_id, v_version, p_reason, p_actor_type, p_actor_id,
    jsonb_build_object('tasks', p_tasks, 'dependencies', p_dependencies)
  );

  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    v_temp_id := COALESCE(v_task->>'tempId', v_task->>'id', gen_random_uuid()::text);
    INSERT INTO agent_tasks (
      tenant_id, run_id, graph_id, graph_version, parent_task_id,
      assigned_agent_id, task_type, title, structured_input, expected_output_schema,
      status, priority, risk_level, approval_policy, retry_policy, timeout_policy,
      verification_criteria, scheduled_at, max_attempts, idempotency_key, correlation_id, metadata
    ) VALUES (
      p_tenant_id,
      p_run_id,
      v_graph_id,
      v_version,
      NULLIF(v_task->>'parentTaskId', '')::UUID,
      v_task->>'assignedAgentId',
      COALESCE(v_task->>'taskType', 'generic'),
      COALESCE(v_task->>'title', 'Untitled task'),
      COALESCE(v_task->'structuredInput', '{}'::jsonb),
      COALESCE(v_task->'expectedOutputSchema', '{}'::jsonb),
      COALESCE(v_task->>'status', 'DRAFT'),
      COALESCE((v_task->>'priority')::INT, 3),
      COALESCE(v_task->>'riskLevel', 'low'),
      COALESCE(v_task->'approvalPolicy', '{}'::jsonb),
      COALESCE(v_task->'retryPolicy', '{"maxAttempts":3,"backoffMs":60000}'::jsonb),
      COALESCE(v_task->'timeoutPolicy', '{"executionMs":300000}'::jsonb),
      COALESCE(v_task->'verificationCriteria', '{}'::jsonb),
      NULLIF(v_task->>'scheduledAt', '')::TIMESTAMPTZ,
      COALESCE((v_task->>'maxAttempts')::INT, 3),
      v_task->>'idempotencyKey',
      NULLIF(v_task->>'correlationId', '')::UUID,
      COALESCE(v_task->'metadata', '{}'::jsonb)
    ) RETURNING id INTO v_real_id;

    v_id_map := v_id_map || jsonb_build_object(v_temp_id, v_real_id);
    v_task_ids := array_append(v_task_ids, v_real_id);
  END LOOP;

  FOR v_dep IN SELECT * FROM jsonb_array_elements(p_dependencies)
  LOOP
    INSERT INTO agent_task_dependencies (
      tenant_id, run_id, task_id, depends_on_task_id, dependency_type, condition
    ) VALUES (
      p_tenant_id,
      p_run_id,
      COALESCE(
        NULLIF(v_dep->>'taskId', '')::UUID,
        (v_id_map ->> (v_dep->>'taskTempId'))::UUID
      ),
      COALESCE(
        NULLIF(v_dep->>'dependsOnTaskId', '')::UUID,
        (v_id_map ->> (v_dep->>'dependsOnTempId'))::UUID
      ),
      COALESCE(v_dep->>'dependencyType', 'finish_to_start'),
      COALESCE(v_dep->'condition', '{}'::jsonb)
    );
  END LOOP;

  UPDATE agent_runs
  SET status = 'running', started_at = COALESCE(started_at, NOW()),
      last_progress_at = NOW(), updated_at = NOW()
  WHERE id = p_run_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'graphId', v_graph_id,
    'version', v_version,
    'taskIds', to_jsonb(v_task_ids),
    'idMap', v_id_map
  );
END;
$$;

-- Claim task atomically with OCC + fencing
CREATE OR REPLACE FUNCTION public.claim_agent_task(
  p_task_id UUID,
  p_tenant_id UUID,
  p_worker_id TEXT,
  p_lease_ms INT DEFAULT 120000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task agent_tasks%ROWTYPE;
  v_attempt_id UUID;
  v_lease_token TEXT := gen_random_uuid()::text;
  v_fencing TEXT;
  v_attempt_number INT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_task
  FROM agent_tasks
  WHERE id = p_task_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_task.status NOT IN ('READY', 'QUEUED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_claimable', 'status', v_task.status);
  END IF;

  IF v_task.scheduled_at IS NOT NULL AND v_task.scheduled_at > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_due');
  END IF;

  v_attempt_number := v_task.attempt_count + 1;
  v_fencing := p_worker_id || ':' || v_attempt_number::text || ':' || v_lease_token;
  v_expires := NOW() + make_interval(secs => GREATEST(p_lease_ms, 5000) / 1000.0);

  UPDATE agent_tasks
  SET status = 'CLAIMED',
      worker_id = p_worker_id,
      lease_token = v_lease_token,
      lease_expires_at = v_expires,
      last_heartbeat_at = NOW(),
      claimed_at = NOW(),
      attempt_count = v_attempt_number,
      version = version + 1,
      updated_at = NOW()
  WHERE id = p_task_id AND tenant_id = p_tenant_id AND version = v_task.version;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'version_conflict');
  END IF;

  INSERT INTO agent_task_attempts (
    tenant_id, task_id, run_id, attempt_number, worker_id, lease_token,
    fencing_token, status, input_snapshot
  ) VALUES (
    p_tenant_id, p_task_id, v_task.run_id, v_attempt_number, p_worker_id,
    v_lease_token, v_fencing, 'running', v_task.structured_input
  ) RETURNING id INTO v_attempt_id;

  INSERT INTO agent_worker_leases (
    tenant_id, task_id, attempt_id, worker_id, lease_token, fencing_token, expires_at
  ) VALUES (
    p_tenant_id, p_task_id, v_attempt_id, p_worker_id, v_lease_token, v_fencing, v_expires
  );

  INSERT INTO agent_state_transitions (
    tenant_id, entity_type, entity_id, previous_state, new_state, trigger,
    actor_type, actor_id, related_attempt_id, expected_version
  ) VALUES (
    p_tenant_id, 'task', p_task_id, v_task.status, 'CLAIMED', 'worker_claim',
    'worker', p_worker_id, v_attempt_id, v_task.version
  );

  RETURN jsonb_build_object(
    'ok', true,
    'taskId', p_task_id,
    'attemptId', v_attempt_id,
    'attemptNumber', v_attempt_number,
    'leaseToken', v_lease_token,
    'fencingToken', v_fencing,
    'leaseExpiresAt', v_expires,
    'version', v_task.version + 1
  );
END;
$$;

-- RLS helpers
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agent_runs', 'agent_graphs', 'agent_graph_versions', 'agent_tasks',
    'agent_task_dependencies', 'agent_task_attempts', 'agent_task_checkpoints',
    'agent_worker_leases', 'agent_idempotency_keys', 'agent_tool_executions',
    'agent_external_references', 'agent_event_inbox', 'agent_event_outbox',
    'agent_event_subscriptions', 'agent_timers', 'agent_approvals',
    'agent_interventions', 'agent_state_transitions', 'agent_reconciliation_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant members manage %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Tenant members manage %I" ON public.%I FOR ALL USING (
         EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())
       ) WITH CHECK (
         EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())
       )', t, t, t, t
    );
  END LOOP;
END $$;

-- reconciliation_logs may have null tenant — allow service reads via policies above only when tenant set
DROP POLICY IF EXISTS "Tenant members manage agent_reconciliation_logs" ON public.agent_reconciliation_logs;
CREATE POLICY "Tenant members manage agent_reconciliation_logs"
  ON public.agent_reconciliation_logs FOR ALL
  USING (
    tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = agent_reconciliation_logs.tenant_id AND tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = agent_reconciliation_logs.tenant_id AND tu.user_id = auth.uid()
    )
  );

COMMIT;
