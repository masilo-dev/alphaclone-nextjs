-- =============================================================================
-- AlphaClone Pricing System Supplement
-- Migration: 20260825000000_pricing_system_supplement.sql
-- =============================================================================
-- Fills gaps in the pricing architecture:
--   1. Pricing analytics funnel events table
--   2. Tenant billing summary RPC for superadmin view
--   3. Correct quota RPC permissions (grant to authenticated)
--   4. Backfill NULL subscription fields to 'free'
-- =============================================================================

-- 1. Pricing Analytics Events Table
-- Tracks the conversion funnel: pricing_page_viewed → checkout_started → checkout_completed
CREATE TABLE IF NOT EXISTS public.pricing_analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  text NOT NULL,
  properties  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_events_tenant ON public.pricing_analytics_events(tenant_id, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_events_name ON public.pricing_analytics_events(event_name, created_at DESC);

ALTER TABLE public.pricing_analytics_events ENABLE ROW LEVEL SECURITY;

-- Superadmins can read all; service_role can insert on behalf of any tenant
DROP POLICY IF EXISTS "Super admins can view pricing events" ON public.pricing_analytics_events;
CREATE POLICY "Super admins can view pricing events"
  ON public.pricing_analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can insert their own pricing events" ON public.pricing_analytics_events;
CREATE POLICY "Users can insert their own pricing events"
  ON public.pricing_analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Tenant Billing Summary RPC (superadmin use)
-- Returns a single row with billing state + today's quota usage for a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_billing_summary(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant    record;
  v_usage     record;
  v_result    jsonb;
BEGIN
  -- Only super admins may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;

  SELECT
    t.id,
    t.name,
    t.subscription_plan,
    t.subscription_status,
    t.stripe_customer_id,
    t.stripe_subscription_id,
    t.stripe_price_id,
    t.current_period_start,
    t.current_period_end,
    t.cancel_at_period_end,
    t.trial_ends_at,
    t.created_at
  INTO v_tenant
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get today's aggregated quota usage across all users for this tenant
  SELECT
    COALESCE(SUM(q.leads), 0)             AS leads,
    COALESCE(SUM(q.outreach_actions), 0)  AS outreach_actions,
    COALESCE(SUM(q.linkedin_posts), 0)    AS linkedin_posts,
    COALESCE(SUM(q.facebook_posts), 0)    AS facebook_posts,
    COALESCE(SUM(q.instagram_posts), 0)   AS instagram_posts,
    COALESCE(SUM(q.email_actions), 0)     AS email_actions,
    COALESCE(SUM(q.mcp_executions), 0)    AS mcp_executions
  INTO v_usage
  FROM public.quota_usage q
  WHERE q.tenant_id = p_tenant_id
    AND q.date = (now() AT TIME ZONE 'UTC')::date;

  v_result := jsonb_build_object(
    'id',                   v_tenant.id,
    'name',                 v_tenant.name,
    'plan',                 COALESCE(v_tenant.subscription_plan, 'free'),
    'status',               COALESCE(v_tenant.subscription_status, 'free'),
    'stripe_customer_id',   v_tenant.stripe_customer_id,
    'stripe_subscription_id', v_tenant.stripe_subscription_id,
    'stripe_price_id',      v_tenant.stripe_price_id,
    'current_period_start', v_tenant.current_period_start,
    'current_period_end',   v_tenant.current_period_end,
    'cancel_at_period_end', COALESCE(v_tenant.cancel_at_period_end, false),
    'trial_ends_at',        v_tenant.trial_ends_at,
    'tenant_created_at',    v_tenant.created_at,
    'today_usage', jsonb_build_object(
      'leads',            COALESCE(v_usage.leads, 0),
      'outreach_actions', COALESCE(v_usage.outreach_actions, 0),
      'linkedin_posts',   COALESCE(v_usage.linkedin_posts, 0),
      'facebook_posts',   COALESCE(v_usage.facebook_posts, 0),
      'instagram_posts',  COALESCE(v_usage.instagram_posts, 0),
      'email_actions',    COALESCE(v_usage.email_actions, 0),
      'mcp_executions',   COALESCE(v_usage.mcp_executions, 0)
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_billing_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_billing_summary(uuid) TO authenticated, service_role;

-- 3. Fix quota RPC permissions
-- The 20260718 migration only granted service_role; authenticated users need it too
-- (The function internally verifies tenant_membership so this is safe)
GRANT EXECUTE ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) TO authenticated, service_role;

-- 4. Backfill NULL subscription fields on existing tenants
UPDATE public.tenants
SET subscription_plan = 'free'
WHERE subscription_plan IS NULL OR subscription_plan = '';

UPDATE public.tenants
SET subscription_status = 'free'
WHERE subscription_status IS NULL OR subscription_status = '';

-- Ensure cancel_at_period_end is not NULL
UPDATE public.tenants
SET cancel_at_period_end = false
WHERE cancel_at_period_end IS NULL;

-- =============================================================================
-- PRICING SYSTEM SUPPLEMENT DEPLOYED
-- =============================================================================
