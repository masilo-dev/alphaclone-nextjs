-- Lead traceability and run logging for the free lead-gen pipeline

BEGIN;

ALTER TABLE public.scraper_leads
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT;

ALTER TABLE public.leads_raw
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT;

CREATE TABLE IF NOT EXISTS public.lead_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.scraper_campaigns(id) ON DELETE CASCADE,
  market TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  source_count INT NOT NULL DEFAULT 0,
  enriched_count INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_run_log_tenant_created
  ON public.lead_run_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_run_log_campaign_created
  ON public.lead_run_log (campaign_id, created_at DESC);

ALTER TABLE public.lead_run_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_view_auto_cron_logs" ON public.automation_cron_logs;
CREATE POLICY "authenticated_view_auto_cron_logs" ON public.automation_cron_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_lead_run_log" ON public.lead_run_log;
CREATE POLICY "service_role_lead_run_log" ON public.lead_run_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_lead_run_log" ON public.lead_run_log;
CREATE POLICY "tenant_lead_run_log" ON public.lead_run_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

COMMIT;
