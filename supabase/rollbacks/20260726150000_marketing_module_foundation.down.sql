-- Rollback for the additive Marketing foundation migration.
-- Existing marketing_campaigns rows and legacy columns are deliberately retained.
DROP TABLE IF EXISTS public.marketing_campaign_metrics_daily;
DROP TABLE IF EXISTS public.marketing_segments;
DROP TABLE IF EXISTS public.marketing_campaign_events;

DROP INDEX IF EXISTS public.idx_marketing_campaigns_tenant_status_active;
DROP INDEX IF EXISTS public.idx_marketing_campaigns_tenant_start;

ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_budget_nonnegative,
  DROP CONSTRAINT IF EXISTS marketing_campaigns_dates_valid;

-- New campaign columns are not dropped automatically because a rollback after use
-- must not destroy production data. They can be removed manually only after export
-- and dependency review.
