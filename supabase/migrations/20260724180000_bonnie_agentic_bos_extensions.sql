-- Bonnie Agentic BOS extensions: verifications, chasing policies, runtime limits.
-- Builds on 20260724170000_bonnie_durable_runtime.sql. Railway-deployed only.

CREATE TABLE IF NOT EXISTS public.agent_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  tool_execution_id UUID REFERENCES public.agent_tool_executions(id) ON DELETE SET NULL,
  verification_type TEXT NOT NULL DEFAULT 'goal_outcome',
  expected_outcome TEXT,
  actual_outcome TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'passed', 'failed', 'inconclusive', 'skipped')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_verifications_run
  ON public.agent_verifications (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_chasing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  terminal_outcomes TEXT[] NOT NULL DEFAULT '{}',
  follow_up_intervals_hours INTEGER[] NOT NULL DEFAULT ARRAY[24, 72, 168],
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0 AND max_attempts <= 50),
  communication_channel TEXT NOT NULL DEFAULT 'email',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  escalation_owner_user_id UUID,
  stop_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  respect_working_hours BOOLEAN NOT NULL DEFAULT true,
  respect_opt_out BOOLEAN NOT NULL DEFAULT true,
  max_communications_per_contact_per_day INTEGER NOT NULL DEFAULT 2,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.agent_runtime_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  max_tasks_per_run INTEGER NOT NULL DEFAULT 200,
  max_parallel_tasks INTEGER NOT NULL DEFAULT 8,
  max_retries INTEGER NOT NULL DEFAULT 5,
  max_graph_depth INTEGER NOT NULL DEFAULT 12,
  max_tool_calls INTEGER NOT NULL DEFAULT 500,
  max_run_cost_cents INTEGER NOT NULL DEFAULT 5000,
  max_run_duration_hours INTEGER NOT NULL DEFAULT 720,
  max_communication_attempts INTEGER NOT NULL DEFAULT 5,
  allowed_agents TEXT[] NOT NULL DEFAULT '{}',
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  autonomous_categories TEXT[] NOT NULL DEFAULT '{}',
  financial_limit_cents INTEGER NOT NULL DEFAULT 0,
  approval_threshold TEXT NOT NULL DEFAULT 'medium'
    CHECK (approval_threshold IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, workspace_id)
);

ALTER TABLE public.agent_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chasing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runtime_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_verifications' AND policyname = 'agent_verifications_tenant_isolation'
  ) THEN
    CREATE POLICY agent_verifications_tenant_isolation ON public.agent_verifications
      FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_chasing_policies' AND policyname = 'agent_chasing_policies_tenant_isolation'
  ) THEN
    CREATE POLICY agent_chasing_policies_tenant_isolation ON public.agent_chasing_policies
      FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_runtime_limits' AND policyname = 'agent_runtime_limits_tenant_isolation'
  ) THEN
    CREATE POLICY agent_runtime_limits_tenant_isolation ON public.agent_runtime_limits
      FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;

GRANT ALL ON TABLE public.agent_verifications TO authenticated, service_role;
GRANT ALL ON TABLE public.agent_chasing_policies TO authenticated, service_role;
GRANT ALL ON TABLE public.agent_runtime_limits TO authenticated, service_role;
