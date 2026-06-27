BEGIN;

-- ── nexus_memory: persistent tenant-scoped business facts ─────────────────
CREATE TABLE IF NOT EXISTS public.nexus_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'pattern' CHECK (category IN ('preference', 'pattern', 'workflow', 'reliability', 'general')),
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('dream', 'manual', 'agent')),
  confidence NUMERIC(4, 3) NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_nexus_memory_tenant_category
  ON public.nexus_memory (tenant_id, category, updated_at DESC);

ALTER TABLE public.nexus_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read nexus memory" ON public.nexus_memory;
CREATE POLICY "Tenant users can read nexus memory" ON public.nexus_memory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = nexus_memory.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can write nexus memory" ON public.nexus_memory;
CREATE POLICY "Tenant admins can write nexus memory" ON public.nexus_memory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = nexus_memory.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = nexus_memory.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

-- ── nexus_decision_log: AI reasoning trace per significant action ─────────────
CREATE TABLE IF NOT EXISTS public.nexus_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id UUID NULL REFERENCES public.mcp_sessions(id) ON DELETE SET NULL,
  instruction TEXT NULL,
  reasoning TEXT NULL,
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'queued_approval', 'executed', 'failed')),
  risk_class TEXT NULL,
  approval_id UUID NULL REFERENCES public.autonomous_runner_approvals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nexus_decision_log_tenant_created
  ON public.nexus_decision_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nexus_decision_log_tool
  ON public.nexus_decision_log (tenant_id, tool_name, created_at DESC);

ALTER TABLE public.nexus_decision_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read nexus decision log" ON public.nexus_decision_log;
CREATE POLICY "Tenant users can read nexus decision log" ON public.nexus_decision_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = nexus_decision_log.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

COMMIT;
