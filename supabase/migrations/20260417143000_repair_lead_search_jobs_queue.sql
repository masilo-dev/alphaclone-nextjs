-- Repair migration for environments that missed the original lead queue migration.
-- Safe to run multiple times.

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

ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS sort_by TEXT DEFAULT 'default';
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS use_playwright BOOLEAN DEFAULT false;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS status public.lead_search_job_status DEFAULT 'pending';
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS current_step TEXT DEFAULT 'init';
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS source_stats JSONB DEFAULT '{"osm":0,"yelp":0,"here":0,"browser":0}'::jsonb;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS source_errors JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS partial_results JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS final_results JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.lead_search_jobs
SET
  niche = COALESCE(niche, 'Unknown niche'),
  sort_by = COALESCE(sort_by, 'default'),
  use_playwright = COALESCE(use_playwright, false),
  status = COALESCE(status, 'pending'::public.lead_search_job_status),
  progress = LEAST(GREATEST(COALESCE(progress, 0), 0), 100),
  current_step = COALESCE(current_step, 'init'),
  source_stats = COALESCE(source_stats, '{"osm":0,"yelp":0,"here":0,"browser":0}'::jsonb),
  source_errors = COALESCE(source_errors, '{}'::jsonb),
  partial_results = COALESCE(partial_results, '[]'::jsonb),
  final_results = COALESCE(final_results, '[]'::jsonb),
  fallback_used = COALESCE(fallback_used, false),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  niche IS NULL
  OR sort_by IS NULL
  OR use_playwright IS NULL
  OR status IS NULL
  OR progress IS NULL
  OR current_step IS NULL
  OR source_stats IS NULL
  OR source_errors IS NULL
  OR partial_results IS NULL
  OR final_results IS NULL
  OR fallback_used IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

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

GRANT SELECT, INSERT, UPDATE ON TABLE public.lead_search_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lead_search_jobs TO service_role;

NOTIFY pgrst, 'reload schema';
