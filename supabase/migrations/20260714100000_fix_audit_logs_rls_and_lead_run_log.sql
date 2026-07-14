-- Fix audit_logs RLS so authenticated app users can insert tenant-scoped audit rows.
-- Add lead_run_log as compatibility alias for older scraper builds (maps to lead_campaign_runs).

BEGIN;

-- ── audit_logs: allow authenticated inserts for own user + tenant membership ──
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      tenant_id IS NULL
      OR tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Service role manages audit logs" ON public.audit_logs;
CREATE POLICY "Service role manages audit logs"
  ON public.audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant members view audit logs" ON public.audit_logs;
CREATE POLICY "Tenant members view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- ── lead_run_log: legacy scraper table name → lead_campaign_runs ─────────────
CREATE TABLE IF NOT EXISTS public.lead_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.scraper_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  current_step TEXT NOT NULL DEFAULT 'init',
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  source_count INT NOT NULL DEFAULT 0,
  enriched_count INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  duration_seconds INT,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lead_run_log_campaign
  ON public.lead_run_log (campaign_id, run_at DESC);

ALTER TABLE public.lead_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_lead_run_log" ON public.lead_run_log;
CREATE POLICY "service_role_lead_run_log" ON public.lead_run_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_lead_run_log" ON public.lead_run_log;
CREATE POLICY "tenant_lead_run_log" ON public.lead_run_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

COMMIT;
