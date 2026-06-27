BEGIN;

CREATE TABLE IF NOT EXISTS public.nexus_orchestration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  task TEXT NOT NULL,
  subagent_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  planned_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_nexus_orchestration_runs_tenant_created
  ON public.nexus_orchestration_runs (tenant_id, created_at DESC);

ALTER TABLE public.nexus_orchestration_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read orchestration runs" ON public.nexus_orchestration_runs;
CREATE POLICY "Tenant users can read orchestration runs" ON public.nexus_orchestration_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = nexus_orchestration_runs.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

COMMIT;
