-- Platform hardening: notifications schema drift, workflow state persistence, PostgREST cache reload

-- Notifications: support both link and action_url; add tenant_id for multi-tenant inserts
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- Backfill action_url from link and vice versa where one side is missing
UPDATE public.notifications
SET action_url = link
WHERE action_url IS NULL AND link IS NOT NULL;

UPDATE public.notifications
SET link = action_url
WHERE link IS NULL AND action_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications(tenant_id);

-- Lightweight workflow state for multi-step MCP playbooks (chief of staff, etc.)
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workflow_id TEXT NOT NULL,
  idempotency_key TEXT,
  current_step TEXT,
  step_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'failed', 'paused')),
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_idempotency
  ON public.workflow_runs(tenant_id, workflow_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_status
  ON public.workflow_runs(tenant_id, status, updated_at DESC);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_read_workflow_runs" ON public.workflow_runs;
CREATE POLICY "tenant_members_read_workflow_runs" ON public.workflow_runs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_users.tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
    )
  );

-- Refresh PostgREST schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';
