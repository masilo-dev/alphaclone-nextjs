-- ============================================================================
-- Bonnie Agentic Business Operating System — Foundation
-- 20260722120000_bonnie_agentic_bos_foundation.sql
--
-- Adds:
--   • Layered memory scopes on nexus_memory (org / user / department)
--   • bonnie_knowledge_nodes / bonnie_knowledge_edges (persisted knowledge graph)
--   • bonnie_digital_twin_snapshots (business digital twin)
--   • bonnie_cognitive_runs (full Observe→…→Learn traces)
--   • bonnie_reflections (post-task reflection + self-improvement signals)
--   • bonnie_agent_executions (specialized agent run ledger)
-- ============================================================================

BEGIN;

-- ── Extend nexus_memory for layered scopes ──────────────────────────────────
ALTER TABLE public.nexus_memory
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'organization'
    CHECK (scope IN ('organization', 'user', 'department', 'short_term', 'long_term'));

ALTER TABLE public.nexus_memory
  ADD COLUMN IF NOT EXISTS scope_id TEXT NULL;

ALTER TABLE public.nexus_memory
  ADD COLUMN IF NOT EXISTS department TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_nexus_memory_scope
  ON public.nexus_memory (tenant_id, scope, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nexus_memory_department
  ON public.nexus_memory (tenant_id, department, updated_at DESC)
  WHERE department IS NOT NULL;

-- ── Knowledge Graph nodes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonnie_knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding_hint TEXT NULL,
  confidence NUMERIC(4, 3) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_bonnie_kg_nodes_tenant_type
  ON public.bonnie_knowledge_nodes (tenant_id, entity_type, updated_at DESC);

ALTER TABLE public.bonnie_knowledge_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read bonnie knowledge nodes" ON public.bonnie_knowledge_nodes;
CREATE POLICY "Tenant users can read bonnie knowledge nodes"
  ON public.bonnie_knowledge_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_knowledge_nodes.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write bonnie knowledge nodes" ON public.bonnie_knowledge_nodes;
CREATE POLICY "Tenant admins can write bonnie knowledge nodes"
  ON public.bonnie_knowledge_nodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_knowledge_nodes.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_knowledge_nodes.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

-- ── Knowledge Graph edges ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonnie_knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES public.bonnie_knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES public.bonnie_knowledge_nodes(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4, 3) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, from_node_id, to_node_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_bonnie_kg_edges_tenant_relation
  ON public.bonnie_knowledge_edges (tenant_id, relation, updated_at DESC);

ALTER TABLE public.bonnie_knowledge_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read bonnie knowledge edges" ON public.bonnie_knowledge_edges;
CREATE POLICY "Tenant users can read bonnie knowledge edges"
  ON public.bonnie_knowledge_edges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_knowledge_edges.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write bonnie knowledge edges" ON public.bonnie_knowledge_edges;
CREATE POLICY "Tenant admins can write bonnie knowledge edges"
  ON public.bonnie_knowledge_edges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_knowledge_edges.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_knowledge_edges.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

-- ── Business Digital Twin snapshots ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonnie_digital_twin_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_score NUMERIC(5, 2) NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'continuous'
    CHECK (source IN ('continuous', 'event', 'manual', 'cognitive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_twin_tenant_created
  ON public.bonnie_digital_twin_snapshots (tenant_id, created_at DESC);

ALTER TABLE public.bonnie_digital_twin_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read digital twin" ON public.bonnie_digital_twin_snapshots;
CREATE POLICY "Tenant users can read digital twin"
  ON public.bonnie_digital_twin_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_digital_twin_snapshots.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write digital twin" ON public.bonnie_digital_twin_snapshots;
CREATE POLICY "Tenant admins can write digital twin"
  ON public.bonnie_digital_twin_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_digital_twin_snapshots.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_digital_twin_snapshots.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

-- ── Cognitive loop runs (full reasoning chain) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonnie_cognitive_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'instruction'
    CHECK (trigger_type IN ('instruction', 'event', 'cron', 'approval_resume', 'continuous')),
  trigger_ref TEXT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4, 3) NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  workflow_id UUID NULL REFERENCES public.bonnie_workflows(id) ON DELETE SET NULL,
  orchestration_run_id UUID NULL REFERENCES public.nexus_orchestration_runs(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_cognitive_tenant_created
  ON public.bonnie_cognitive_runs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bonnie_cognitive_status
  ON public.bonnie_cognitive_runs (tenant_id, status, created_at DESC);

ALTER TABLE public.bonnie_cognitive_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read cognitive runs" ON public.bonnie_cognitive_runs;
CREATE POLICY "Tenant users can read cognitive runs"
  ON public.bonnie_cognitive_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_cognitive_runs.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write cognitive runs" ON public.bonnie_cognitive_runs;
CREATE POLICY "Tenant admins can write cognitive runs"
  ON public.bonnie_cognitive_runs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_cognitive_runs.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_cognitive_runs.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

-- ── Reflections (learn + improve after every task) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.bonnie_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cognitive_run_id UUID NULL REFERENCES public.bonnie_cognitive_runs(id) ON DELETE SET NULL,
  workflow_id UUID NULL REFERENCES public.bonnie_workflows(id) ON DELETE SET NULL,
  what_worked JSONB NOT NULL DEFAULT '[]'::jsonb,
  what_failed JSONB NOT NULL DEFAULT '[]'::jsonb,
  lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  memory_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflow_reuse_candidate BOOLEAN NOT NULL DEFAULT false,
  improvement_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4, 3) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_reflections_tenant_created
  ON public.bonnie_reflections (tenant_id, created_at DESC);

ALTER TABLE public.bonnie_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read reflections" ON public.bonnie_reflections;
CREATE POLICY "Tenant users can read reflections"
  ON public.bonnie_reflections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_reflections.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write reflections" ON public.bonnie_reflections;
CREATE POLICY "Tenant admins can write reflections"
  ON public.bonnie_reflections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_reflections.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_reflections.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

-- ── Specialized agent execution ledger ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bonnie_agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cognitive_run_id UUID NULL REFERENCES public.bonnie_cognitive_runs(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4, 3) NULL,
  duration_ms INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_agent_exec_tenant_created
  ON public.bonnie_agent_executions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bonnie_agent_exec_agent
  ON public.bonnie_agent_executions (tenant_id, agent_id, created_at DESC);

ALTER TABLE public.bonnie_agent_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read agent executions" ON public.bonnie_agent_executions;
CREATE POLICY "Tenant users can read agent executions"
  ON public.bonnie_agent_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_agent_executions.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write agent executions" ON public.bonnie_agent_executions;
CREATE POLICY "Tenant admins can write agent executions"
  ON public.bonnie_agent_executions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_agent_executions.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_agent_executions.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

COMMIT;
