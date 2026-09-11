DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_search_job_status') THEN
    CREATE TYPE public.lead_search_job_status AS ENUM (
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lead_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche TEXT NOT NULL,
  location TEXT,
  sort_by TEXT NOT NULL DEFAULT 'default',
  use_playwright BOOLEAN NOT NULL DEFAULT false,
  status public.lead_search_job_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT NOT NULL DEFAULT 'init',
  source_stats JSONB NOT NULL DEFAULT '{"osm":0,"yelp":0,"here":0,"browser":0}'::jsonb,
  source_errors JSONB NOT NULL DEFAULT '{}'::jsonb,
  partial_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_search_jobs_tenant_created
  ON public.lead_search_jobs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_search_jobs_tenant_status
  ON public.lead_search_jobs (tenant_id, status, created_at DESC);

ALTER TABLE public.lead_search_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_search_jobs_select_tenant_members ON public.lead_search_jobs;
CREATE POLICY lead_search_jobs_select_tenant_members
  ON public.lead_search_jobs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_search_jobs_insert_tenant_members ON public.lead_search_jobs;
CREATE POLICY lead_search_jobs_insert_tenant_members
  ON public.lead_search_jobs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_search_jobs_update_tenant_members ON public.lead_search_jobs;
CREATE POLICY lead_search_jobs_update_tenant_members
  ON public.lead_search_jobs
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
