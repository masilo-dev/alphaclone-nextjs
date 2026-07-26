-- Marketing module foundation. Additive and backwards-compatible; no production rows are removed.

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS spend_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

UPDATE public.marketing_campaigns
SET objective = COALESCE(NULLIF(objective, ''), 'custom'),
    owner_user_id = COALESCE(owner_user_id, created_by),
    start_at = COALESCE(start_at, scheduled_at)
WHERE objective IS NULL OR owner_user_id IS NULL OR (start_at IS NULL AND scheduled_at IS NOT NULL);

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_type_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check CHECK (
    status IN ('draft','pending_approval','scheduled','active','running','paused','completed','cancelled','archived')
  ) NOT VALID,
  ADD CONSTRAINT marketing_campaigns_type_check CHECK (
    type IN ('email','sms','whatsapp','facebook','instagram','linkedin','google_ads','website',
             'landing_page','form','organic_social','referral','manual_outreach','multi_channel')
  ) NOT VALID,
  ADD CONSTRAINT marketing_campaigns_budget_nonnegative CHECK (
    budget_amount IS NULL OR budget_amount >= 0
  ) NOT VALID,
  ADD CONSTRAINT marketing_campaigns_dates_valid CHECK (
    start_at IS NULL OR end_at IS NULL OR end_at > start_at
  ) NOT VALID;

ALTER TABLE public.marketing_campaigns VALIDATE CONSTRAINT marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns VALIDATE CONSTRAINT marketing_campaigns_type_check;
ALTER TABLE public.marketing_campaigns VALIDATE CONSTRAINT marketing_campaigns_budget_nonnegative;
ALTER TABLE public.marketing_campaigns VALIDATE CONSTRAINT marketing_campaigns_dates_valid;

CREATE TABLE IF NOT EXISTS public.marketing_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_value JSONB,
  new_value JSONB,
  source TEXT NOT NULL DEFAULT 'dashboard',
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.marketing_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  segment_type TEXT NOT NULL DEFAULT 'dynamic'
    CHECK (segment_type IN ('static','dynamic','imported','lookalike','suppression')),
  rules JSONB NOT NULL DEFAULT '{"operator":"and","rules":[]}'::jsonb,
  estimated_size INTEGER,
  last_calculated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','calculating','failed','archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.marketing_campaign_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  channel TEXT NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  delivered BIGINT NOT NULL DEFAULT 0,
  opens BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  replies BIGINT NOT NULL DEFAULT 0,
  leads BIGINT NOT NULL DEFAULT 0,
  customers BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC(18,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, campaign_id, metric_date, channel)
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_status_active
  ON public.marketing_campaigns (tenant_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_start
  ON public.marketing_campaigns (tenant_id, start_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_events_tenant_campaign_time
  ON public.marketing_campaign_events (tenant_id, campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_tenant_status
  ON public.marketing_segments (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_metrics_campaign_date
  ON public.marketing_campaign_metrics_daily (tenant_id, campaign_id, metric_date DESC);

ALTER TABLE public.marketing_campaign_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_metrics_daily ENABLE ROW LEVEL SECURITY;

-- tenant_users is the trusted membership source; JWT tenant claims are not relied upon.
DO $policies$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'marketing_campaigns', 'marketing_campaign_events', 'marketing_segments',
    'marketing_campaign_metrics_daily'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS marketing_tenant_select ON public.%I', table_name);
    IF table_name IN ('marketing_campaigns', 'marketing_segments') THEN
      EXECUTE format(
        'CREATE POLICY marketing_tenant_select ON public.%I FOR SELECT TO authenticated USING
         (deleted_at IS NULL AND EXISTS (
           SELECT 1 FROM public.tenant_users tu
           WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()
         ))',
        table_name, table_name
      );
    END IF;
  END LOOP;
END $policies$;

DROP POLICY IF EXISTS marketing_events_select ON public.marketing_campaign_events;
CREATE POLICY marketing_events_select ON public.marketing_campaign_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_users tu
  WHERE tu.tenant_id = marketing_campaign_events.tenant_id AND tu.user_id = auth.uid()
));
DROP POLICY IF EXISTS marketing_metrics_select ON public.marketing_campaign_metrics_daily;
CREATE POLICY marketing_metrics_select ON public.marketing_campaign_metrics_daily FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_users tu
  WHERE tu.tenant_id = marketing_campaign_metrics_daily.tenant_id AND tu.user_id = auth.uid()
));

DROP POLICY IF EXISTS marketing_campaigns_write ON public.marketing_campaigns;
CREATE POLICY marketing_campaigns_write ON public.marketing_campaigns FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = marketing_campaigns.tenant_id
  AND tu.user_id = auth.uid() AND tu.role IN ('owner','admin','tenant_admin','super_admin','staff')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = marketing_campaigns.tenant_id
  AND tu.user_id = auth.uid() AND tu.role IN ('owner','admin','tenant_admin','super_admin','staff')
));

COMMENT ON TABLE public.marketing_campaign_metrics_daily IS
  'Pre-aggregated real campaign metrics. Never populate with invented or demo values in production.';
