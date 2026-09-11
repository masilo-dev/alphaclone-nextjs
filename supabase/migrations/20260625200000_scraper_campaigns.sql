-- Scraper campaign system for Python lead scraper microservice
-- Tables: scraper_campaigns, leads_raw, scraper_leads, lead_campaign_runs

BEGIN;

CREATE TABLE IF NOT EXISTS public.scraper_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused'
    CHECK (status IN ('active', 'paused', 'completed')),
  source TEXT,
  sources TEXT[] DEFAULT '{}',
  location JSONB DEFAULT '{}',
  industry TEXT[] DEFAULT '{}',
  title_keywords TEXT[] DEFAULT '{}',
  company_size_range JSONB DEFAULT '{}',
  exclude_domains TEXT[] DEFAULT '{}',
  daily_limit INT NOT NULL DEFAULT 50,
  weekly_limit INT NOT NULL DEFAULT 200,
  enrichment_level TEXT NOT NULL DEFAULT 'full'
    CHECK (enrichment_level IN ('basic', 'full')),
  scoring_rules JSONB DEFAULT '{}',
  min_score_threshold INT NOT NULL DEFAULT 40,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraper_campaigns_active
  ON public.scraper_campaigns (tenant_id, status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.leads_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.scraper_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}',
  scrape_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_raw_campaign
  ON public.leads_raw (campaign_id, scrape_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.scraper_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.scraper_campaigns(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  company TEXT,
  company_website TEXT,
  company_size INT,
  industry TEXT,
  linkedin_url TEXT,
  source TEXT,
  score INT,
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D')),
  quality_reason TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'disqualified', 'synced')),
  crm_lead_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enriched_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scraper_leads_dedup
  ON public.scraper_leads (tenant_id, lower(email), lower(company))
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS idx_scraper_leads_campaign
  ON public.scraper_leads (campaign_id, score DESC);

CREATE TABLE IF NOT EXISTS public.lead_campaign_runs (
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
  duration_seconds INT
);

CREATE INDEX IF NOT EXISTS idx_lead_campaign_runs_campaign
  ON public.lead_campaign_runs (campaign_id, run_at DESC);

-- RLS
ALTER TABLE public.scraper_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaign_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_scraper_campaigns" ON public.scraper_campaigns;
CREATE POLICY "service_role_scraper_campaigns" ON public.scraper_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_scraper_campaigns" ON public.scraper_campaigns;
CREATE POLICY "tenant_scraper_campaigns" ON public.scraper_campaigns
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_leads_raw" ON public.leads_raw;
CREATE POLICY "service_role_leads_raw" ON public.leads_raw
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_leads_raw" ON public.leads_raw;
CREATE POLICY "tenant_leads_raw" ON public.leads_raw
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_scraper_leads" ON public.scraper_leads;
CREATE POLICY "service_role_scraper_leads" ON public.scraper_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_scraper_leads" ON public.scraper_leads;
CREATE POLICY "tenant_scraper_leads" ON public.scraper_leads
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_lead_campaign_runs" ON public.lead_campaign_runs;
CREATE POLICY "service_role_lead_campaign_runs" ON public.lead_campaign_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_lead_campaign_runs" ON public.lead_campaign_runs;
CREATE POLICY "tenant_lead_campaign_runs" ON public.lead_campaign_runs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

COMMIT;
