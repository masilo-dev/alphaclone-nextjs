-- Bonnie Agentic BOS — persistent Goals + Subtasks + cognitive run ledger
-- Goals survive refresh/logout/deploy; subtasks track agent work + approvals.
-- Also ensures cognitive run tables exist (used by the Agentic OS loop).

BEGIN;

-- Cognitive run ledger (may already exist in some environments)
CREATE TABLE IF NOT EXISTS public.bonnie_cognitive_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_type TEXT NULL,
  trigger_ref TEXT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  workflow_id UUID NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  orchestration_run_id UUID NULL,
  goal_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_bonnie_cognitive_runs_tenant
  ON public.bonnie_cognitive_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bonnie_agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cognitive_run_id UUID NULL REFERENCES public.bonnie_cognitive_runs(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  department TEXT NULL,
  role TEXT NULL,
  task TEXT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC NULL,
  duration_ms INT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_agent_executions_run
  ON public.bonnie_agent_executions (cognitive_run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bonnie_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'draft', 'active', 'blocked', 'awaiting_approval',
      'monitoring', 'completed', 'failed', 'cancelled'
    )),
  progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (progress_pct >= 0 AND progress_pct <= 100),
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  execution_mode TEXT NOT NULL DEFAULT 'approval_required'
    CHECK (execution_mode IN (
      'ask_only', 'plan_only', 'approval_required', 'semi_autonomous', 'fully_autonomous'
    )),
  owner_agent_id TEXT NULL,
  source_trigger TEXT NULL,
  source_event_type TEXT NULL,
  source_event_id TEXT NULL,
  conversation_id UUID NULL,
  workflow_id UUID NULL,
  latest_cognitive_run_id UUID NULL,
  waiting_for TEXT NULL,
  blocker_reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

-- Soft FKs when related tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bonnie_conversations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bonnie_goals_conversation_id_fkey'
      AND table_name = 'bonnie_goals'
  ) THEN
    ALTER TABLE public.bonnie_goals
      ADD CONSTRAINT bonnie_goals_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.bonnie_conversations(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bonnie_workflows'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bonnie_goals_workflow_id_fkey'
      AND table_name = 'bonnie_goals'
  ) THEN
    ALTER TABLE public.bonnie_goals
      ADD CONSTRAINT bonnie_goals_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES public.bonnie_workflows(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bonnie_goals_tenant_status
  ON public.bonnie_goals (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonnie_goals_tenant_user
  ON public.bonnie_goals (tenant_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonnie_goals_waiting
  ON public.bonnie_goals (tenant_id, waiting_for)
  WHERE waiting_for IS NOT NULL AND status IN ('active', 'blocked', 'awaiting_approval', 'monitoring');

CREATE TABLE IF NOT EXISTS public.bonnie_goal_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.bonnie_goals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_subtask_id UUID NULL REFERENCES public.bonnie_goal_subtasks(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'ready', 'running', 'blocked',
      'awaiting_approval', 'done', 'skipped', 'failed'
    )),
  assigned_agent_id TEXT NULL,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocker_reason TEXT NULL,
  blocked_by_subtask_id UUID NULL REFERENCES public.bonnie_goal_subtasks(id) ON DELETE SET NULL,
  approval_id UUID NULL,
  cognitive_run_id UUID NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_bonnie_goal_subtasks_goal
  ON public.bonnie_goal_subtasks (goal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bonnie_goal_subtasks_status
  ON public.bonnie_goal_subtasks (tenant_id, status, updated_at DESC);

ALTER TABLE public.bonnie_cognitive_runs
  ADD COLUMN IF NOT EXISTS goal_id UUID NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bonnie_workflows'
  ) THEN
    ALTER TABLE public.bonnie_workflows
      ADD COLUMN IF NOT EXISTS goal_id UUID NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'autonomous_runner_approvals'
  ) THEN
    ALTER TABLE public.autonomous_runner_approvals
      ADD COLUMN IF NOT EXISTS goal_id UUID NULL,
      ADD COLUMN IF NOT EXISTS goal_subtask_id UUID NULL;
  END IF;
END $$;

ALTER TABLE public.bonnie_cognitive_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonnie_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonnie_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonnie_goal_subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage bonnie_cognitive_runs" ON public.bonnie_cognitive_runs;
CREATE POLICY "Tenant members manage bonnie_cognitive_runs"
  ON public.bonnie_cognitive_runs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_cognitive_runs.tenant_id AND tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_cognitive_runs.tenant_id AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members manage bonnie_agent_executions" ON public.bonnie_agent_executions;
CREATE POLICY "Tenant members manage bonnie_agent_executions"
  ON public.bonnie_agent_executions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_agent_executions.tenant_id AND tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_agent_executions.tenant_id AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members manage bonnie_goals" ON public.bonnie_goals;
CREATE POLICY "Tenant members manage bonnie_goals"
  ON public.bonnie_goals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_goals.tenant_id AND tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_goals.tenant_id AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant members manage bonnie_goal_subtasks" ON public.bonnie_goal_subtasks;
CREATE POLICY "Tenant members manage bonnie_goal_subtasks"
  ON public.bonnie_goal_subtasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_goal_subtasks.tenant_id AND tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_goal_subtasks.tenant_id AND tu.user_id = auth.uid()
    )
  );

COMMIT;
