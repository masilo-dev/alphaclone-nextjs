-- Migration: 20261010120000_apify_lead_finder.sql
-- Production Apify Lead Finder Integration (Additive & Backward-Compatible)

BEGIN;

-- 1. Extend lead_searches with Apify run metadata and cost tracking
ALTER TABLE public.lead_searches
  ADD COLUMN IF NOT EXISTS apify_run_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_dataset_id TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compute_units NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_country TEXT,
  ADD COLUMN IF NOT EXISTS filter_no_website BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Extend lead_search_jobs with Apify run reference and cost tracking
ALTER TABLE public.lead_search_jobs
  ADD COLUMN IF NOT EXISTS apify_run_id TEXT,
  ADD COLUMN IF NOT EXISTS apify_dataset_id TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0;

-- 3. Extend lead_candidates with Apify place ID, Maps URL, and social-first indicator
ALTER TABLE public.lead_candidates
  ADD COLUMN IF NOT EXISTS apify_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS email_source_url TEXT,
  ADD COLUMN IF NOT EXISTS is_social_first BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Index for quick lookup and deduplication by place ID
CREATE INDEX IF NOT EXISTS idx_lead_candidates_apify_place 
  ON public.lead_candidates(workspace_id, apify_place_id) 
  WHERE apify_place_id IS NOT NULL;

-- 5. Index for quick lookup by Google Maps URL
CREATE INDEX IF NOT EXISTS idx_lead_candidates_google_maps_url
  ON public.lead_candidates(workspace_id, google_maps_url)
  WHERE google_maps_url IS NOT NULL;

COMMIT;
