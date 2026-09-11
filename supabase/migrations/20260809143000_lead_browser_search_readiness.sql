-- Browser lead search readiness: proof, confidence, dedupe, and status fields.

BEGIN;

ALTER TABLE public.scraper_leads
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score INT CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS match_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (enrichment_status IN ('queued', 'searching', 'enriching', 'verifying', 'completed', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'partial', 'verified', 'invalid', 'failed')),
  ADD COLUMN IF NOT EXISTS duplicate_status TEXT NOT NULL DEFAULT 'unique'
    CHECK (duplicate_status IN ('unique', 'possible', 'duplicate', 'merged')),
  ADD COLUMN IF NOT EXISTS duplicate_of_id UUID,
  ADD COLUMN IF NOT EXISTS duplicate_of_type TEXT,
  ADD COLUMN IF NOT EXISTS source_health JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.lead_campaign_runs
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS source_health JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.lead_candidates
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS match_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (enrichment_status IN ('queued', 'searching', 'enriching', 'verifying', 'completed', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS source_health JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scraper_leads_tenant_dedupe_key
  ON public.scraper_leads (tenant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraper_leads_tenant_verification
  ON public.scraper_leads (tenant_id, verification_status, enrichment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraper_leads_source_urls_gin
  ON public.scraper_leads USING gin (source_urls);

CREATE INDEX IF NOT EXISTS idx_lead_candidates_workspace_dedupe_key
  ON public.lead_candidates (workspace_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_candidates_source_urls_gin
  ON public.lead_candidates USING gin (source_urls);

COMMIT;
