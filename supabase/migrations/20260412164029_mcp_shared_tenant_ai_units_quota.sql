-- Shared tenant AI usage quota (MCP tools + HTTP AI routes). Row-locked RPC; service_role only.
-- Applied to hosted project via Supabase MCP apply_migration (name: mcp_shared_tenant_ai_units_quota).
-- Idempotent with 20260412150000_ai_lead_generation_daily.sql (same table for lead counts + units).

CREATE TABLE IF NOT EXISTS public.ai_lead_generation_daily (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  leads_count INTEGER NOT NULL DEFAULT 0 CHECK (leads_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_lead_gen_daily_date ON public.ai_lead_generation_daily(usage_date);

ALTER TABLE public.ai_lead_generation_daily
  ADD COLUMN IF NOT EXISTS ai_units INTEGER NOT NULL DEFAULT 0 CHECK (ai_units >= 0);

COMMENT ON TABLE public.ai_lead_generation_daily IS 'Per-tenant UTC daily: AI lead counts from /api/ai/leads and weighted AI usage units (MCP + HTTP); service role and consume_tenant_ai_units.';

COMMENT ON COLUMN public.ai_lead_generation_daily.ai_units IS 'Weighted AI usage units consumed this UTC day (generate, chat, vision, MCP contract draft, etc.).';

CREATE OR REPLACE FUNCTION public.consume_tenant_ai_units(
  p_tenant_id UUID,
  p_units INTEGER,
  p_daily_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := (timezone('utc', now()))::date;
  v_used INTEGER;
BEGIN
  IF p_daily_limit < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_limit');
  END IF;

  IF p_units <= 0 THEN
    INSERT INTO public.ai_lead_generation_daily (tenant_id, usage_date, leads_count, ai_units)
    VALUES (p_tenant_id, v_date, 0, 0)
    ON CONFLICT (tenant_id, usage_date) DO NOTHING;

    SELECT COALESCE(ai_units, 0) INTO v_used
    FROM public.ai_lead_generation_daily
    WHERE tenant_id = p_tenant_id AND usage_date = v_date;

    RETURN jsonb_build_object(
      'ok', true,
      'used', COALESCE(v_used, 0),
      'limit', p_daily_limit,
      'remaining', GREATEST(0, p_daily_limit - COALESCE(v_used, 0))
    );
  END IF;

  INSERT INTO public.ai_lead_generation_daily (tenant_id, usage_date, leads_count, ai_units)
  VALUES (p_tenant_id, v_date, 0, 0)
  ON CONFLICT (tenant_id, usage_date) DO NOTHING;

  SELECT COALESCE(ai_units, 0) INTO v_used
  FROM public.ai_lead_generation_daily
  WHERE tenant_id = p_tenant_id AND usage_date = v_date
  FOR UPDATE;

  IF v_used + p_units > p_daily_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'used', v_used,
      'limit', p_daily_limit,
      'remaining', GREATEST(0, p_daily_limit - v_used)
    );
  END IF;

  UPDATE public.ai_lead_generation_daily
  SET ai_units = ai_units + p_units, updated_at = now()
  WHERE tenant_id = p_tenant_id AND usage_date = v_date;

  RETURN jsonb_build_object(
    'ok', true,
    'used', v_used + p_units,
    'limit', p_daily_limit,
    'remaining', p_daily_limit - v_used - p_units
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_tenant_ai_units(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_tenant_ai_units(UUID, INTEGER, INTEGER) TO service_role;

ALTER TABLE public.ai_lead_generation_daily ENABLE ROW LEVEL SECURITY;
