-- Track AI/API lead discovery volume per tenant per UTC day (enforces plan limits on /api/ai/leads).

CREATE TABLE IF NOT EXISTS public.ai_lead_generation_daily (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  leads_count INTEGER NOT NULL DEFAULT 0 CHECK (leads_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_lead_gen_daily_date ON public.ai_lead_generation_daily(usage_date);

COMMENT ON TABLE public.ai_lead_generation_daily IS 'Per-tenant UTC daily: AI lead counts (/api/ai/leads) and weighted AI usage units (MCP + HTTP); see consume_tenant_ai_units.';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_morning_bundle_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_morning_bundle_sent_at IS 'Last UTC day the user received the two-part morning email bundle.';

-- Extend email_preferences defaults (merge in app for existing rows; new profiles get full default from migration on profiles... actually existing rows keep old json — app treats missing keys as true)
