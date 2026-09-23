-- Scrapy Web Research and Lead Discovery Engine Migration
-- Adds tenant-scoped research jobs and staged lead research results before CRM entry.

BEGIN;

CREATE TABLE IF NOT EXISTS public.research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  industry TEXT,
  location TEXT,
  target_count INT NOT NULL DEFAULT 50 CHECK (target_count BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN (
      'queued',
      'discovering',
      'crawling',
      'extracting',
      'validating',
      'qualifying',
      'completed',
      'partially_completed',
      'cancelled',
      'failed'
    )
  ),
  sources JSONB NOT NULL DEFAULT '["public_websites","directories","osm"]'::jsonb,
  qualification_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  discovered_count INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  qualified_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_jobs_tenant_status_idx
  ON public.research_jobs(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS research_jobs_tenant_created_idx
  ON public.research_jobs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_job_id UUID NOT NULL REFERENCES public.research_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  website TEXT,
  domain TEXT,
  public_email TEXT,
  email_status TEXT NOT NULL DEFAULT 'not_found' CHECK (email_status IN ('found', 'not_found', 'verified', 'invalid')),
  public_phone TEXT,
  location TEXT,
  industry TEXT,
  description TEXT,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_page TEXT,
  about_page TEXT,
  linkedin_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  other_social_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_type TEXT NOT NULL DEFAULT 'public_website',
  activity_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualification_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualification_score INT NOT NULL DEFAULT 0 CHECK (qualification_score BETWEEN 0 AND 100),
  confidence_score INT NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  is_qualified BOOLEAN NOT NULL DEFAULT false,
  qualification_reason TEXT,
  disqualification_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  dedupe_status TEXT NOT NULL DEFAULT 'unique' CHECK (dedupe_status IN ('unique', 'duplicate')),
  duplicate_reason TEXT,
  review_status TEXT NOT NULL DEFAULT 'staged' CHECK (review_status IN ('staged', 'approved', 'rejected', 'in_review', 'imported')),
  imported_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  crawl_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_research_results_job_idx
  ON public.lead_research_results(tenant_id, research_job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_research_results_tenant_domain_idx
  ON public.lead_research_results(tenant_id, domain) WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS lead_research_results_tenant_review_idx
  ON public.lead_research_results(tenant_id, review_status);

CREATE INDEX IF NOT EXISTS lead_research_results_tenant_qualified_idx
  ON public.lead_research_results(tenant_id, is_qualified);

-- Row Level Security
ALTER TABLE public.research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_research_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_jobs_tenant_policy ON public.research_jobs;
CREATE POLICY research_jobs_tenant_policy ON public.research_jobs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = research_jobs.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = research_jobs.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS research_jobs_service_role ON public.research_jobs;
CREATE POLICY research_jobs_service_role ON public.research_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS lead_research_results_tenant_policy ON public.lead_research_results;
CREATE POLICY lead_research_results_tenant_policy ON public.lead_research_results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = lead_research_results.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.tenant_id = lead_research_results.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_research_results_service_role ON public.lead_research_results;
CREATE POLICY lead_research_results_service_role ON public.lead_research_results
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
