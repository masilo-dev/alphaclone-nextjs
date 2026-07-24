-- Geo + reach fields for product-ready Lead Finder maps and CRM sync

BEGIN;

ALTER TABLE public.scraper_leads
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS reach_km NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS search_center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS search_center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scraper_leads_geo
  ON public.scraper_leads (tenant_id, lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraper_leads_reach
  ON public.scraper_leads (campaign_id, reach_km ASC NULLS LAST)
  WHERE reach_km IS NOT NULL;

COMMIT;
