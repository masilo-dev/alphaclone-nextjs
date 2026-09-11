-- Additive bridge from legacy scraper records to the canonical Lead Finder.
BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_provider_settings (
  workspace_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  free_only BOOLEAN NOT NULL DEFAULT TRUE,
  providers JSONB NOT NULL DEFAULT '{"openstreetmap":true,"wikidata":true,"searxng":true,"website_crawler":true,"here":false,"hunter":false,"apollo":false,"builtwith":false}'::jsonb,
  scoring_weights JSONB NOT NULL DEFAULT '{"fit":0.25,"contactability":0.20,"quality":0.20,"confidence":0.15,"freshness":0.10,"opportunity":0.10}'::jsonb,
  -- Acceptance is a workflow decision. Discovery must never turn into outreach
  -- or CRM promotion unless an administrator explicitly enables it.
  auto_accept_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_accept_threshold INTEGER NOT NULL DEFAULT 72 CHECK (auto_accept_threshold BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_provider_health (
  workspace_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  request_count BIGINT NOT NULL DEFAULT 0,
  success_count BIGINT NOT NULL DEFAULT 0,
  failure_count BIGINT NOT NULL DEFAULT 0,
  rate_limit_count BIGINT NOT NULL DEFAULT 0,
  results_returned BIGINT NOT NULL DEFAULT 0,
  average_latency_ms INTEGER NOT NULL DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  circuit_open_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS public.lead_discovery_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lead_discovery_cache_expiry_idx ON public.lead_discovery_cache (expires_at);
ALTER TABLE public.lead_discovery_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_discovery_cache FROM anon, authenticated;

ALTER TABLE public.lead_candidates
  ADD COLUMN IF NOT EXISTS canonical_business_key TEXT,
  ADD COLUMN IF NOT EXISTS contactability_score INTEGER NOT NULL DEFAULT 0 CHECK (contactability_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS freshness_score INTEGER NOT NULL DEFAULT 0 CHECK (freshness_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS opportunity_score INTEGER NOT NULL DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS final_score INTEGER NOT NULL DEFAULT 0 CHECK (final_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS outreach_memory_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS field_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_sightings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Give historical rows stable, non-colliding bridge keys. New rows receive a
-- true business identity from the worker (email/domain/phone/name-location).
-- We deliberately do not guess identities during this additive migration.
UPDATE public.lead_candidates
SET canonical_business_key = 'legacy:' || id::text
WHERE canonical_business_key IS NULL OR canonical_business_key = '';
ALTER TABLE public.lead_candidates ALTER COLUMN canonical_business_key SET NOT NULL;
ALTER TABLE public.lead_candidates DROP CONSTRAINT IF EXISTS lead_candidates_workspace_business_key_unique;
ALTER TABLE public.lead_candidates
  ADD CONSTRAINT lead_candidates_workspace_business_key_unique UNIQUE (workspace_id, canonical_business_key);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS canonical_business_key TEXT;
UPDATE public.leads SET canonical_business_key = 'legacy:' || id::text WHERE canonical_business_key IS NULL OR canonical_business_key = '';
ALTER TABLE public.leads ALTER COLUMN canonical_business_key SET DEFAULT ('lead:' || gen_random_uuid()::text);
ALTER TABLE public.leads ALTER COLUMN canonical_business_key SET NOT NULL;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_tenant_business_key_unique;
ALTER TABLE public.leads ADD CONSTRAINT leads_tenant_business_key_unique UNIQUE (tenant_id, canonical_business_key);

ALTER TABLE public.scraper_campaigns
  ADD COLUMN IF NOT EXISTS canonical_search_id UUID REFERENCES public.lead_searches(id) ON DELETE SET NULL;
ALTER TABLE public.scraper_leads
  ADD COLUMN IF NOT EXISTS canonical_lead_candidate_id UUID REFERENCES public.lead_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS scraper_leads_candidate_bridge_idx ON public.scraper_leads (tenant_id, canonical_lead_candidate_id) WHERE canonical_lead_candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scraper_leads_lead_bridge_idx ON public.scraper_leads (tenant_id, canonical_lead_id) WHERE canonical_lead_id IS NOT NULL;

ALTER TABLE public.lead_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_provider_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant admins manage lead providers" ON public.lead_provider_settings;
CREATE POLICY "Tenant admins manage lead providers" ON public.lead_provider_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = workspace_id AND tu.user_id = auth.uid() AND tu.role IN ('owner','admin','tenant_admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = workspace_id AND tu.user_id = auth.uid() AND tu.role IN ('owner','admin','tenant_admin','super_admin')));
DROP POLICY IF EXISTS "Tenant members read lead provider health" ON public.lead_provider_health;
CREATE POLICY "Tenant members read lead provider health" ON public.lead_provider_health FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = workspace_id AND tu.user_id = auth.uid()));

-- Safe report: no legacy rows are deleted or silently promoted.
CREATE OR REPLACE VIEW public.lead_finder_migration_report AS
SELECT t.id AS workspace_id,
  (SELECT COUNT(*) FROM public.scraper_leads sl WHERE sl.tenant_id = t.id) AS scraper_leads_count,
  (SELECT COUNT(*) FROM public.lead_candidates lc WHERE lc.workspace_id = t.id) AS lead_candidates_count,
  (SELECT COUNT(*) FROM public.leads l WHERE l.tenant_id = t.id) AS leads_count,
  (SELECT COUNT(*) FROM public.scraper_leads sl WHERE sl.tenant_id = t.id AND (sl.canonical_lead_candidate_id IS NOT NULL OR sl.canonical_lead_id IS NOT NULL)) AS canonical_relationships_created,
  (SELECT COUNT(*) FROM public.lead_candidates lc WHERE lc.workspace_id = t.id AND lc.duplicate_status IN ('duplicate','merged')) AS canonical_duplicates_flagged,
  (SELECT COUNT(*) FROM public.scraper_leads sl WHERE sl.tenant_id = t.id AND sl.canonical_lead_candidate_id IS NULL AND sl.canonical_lead_id IS NULL) AS rows_requiring_manual_review
FROM public.tenants t;
REVOKE ALL ON public.lead_finder_migration_report FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lead_finder_migration_report TO service_role;

COMMIT;
