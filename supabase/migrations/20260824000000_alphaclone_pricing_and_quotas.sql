-- AlphaClone Pricing Architecture & Daily Quota Tracking Migration
-- Migration: 20260824000000_alphaclone_pricing_and_quotas.sql

-- 1. Ensure tenant subscription columns exist on tenants table
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

-- Index for fast customer lookup
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON public.tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_plan ON public.tenants(subscription_plan);

-- 2. Expand quota_usage table with mandatory plan metrics
ALTER TABLE public.quota_usage 
  ADD COLUMN IF NOT EXISTS outreach_actions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkedin_posts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facebook_posts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instagram_posts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_actions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mcp_executions integer NOT NULL DEFAULT 0;

-- 3. Atomic daily quota consumption RPC function
CREATE OR REPLACE FUNCTION public.consume_daily_resource_quota(
  p_tenant_id uuid,
  p_user_id uuid,
  p_resource text,
  p_amount integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.quota_usage%ROWTYPE;
  v_plan text;
  v_custom_limits jsonb;
  v_limit integer;
  v_current integer;
BEGIN
  IF p_resource NOT IN (
    'leads', 'outreach_actions', 'linkedin_posts', 'facebook_posts', 
    'instagram_posts', 'email_actions', 'mcp_executions',
    'contracts', 'invoices', 'receipts'
  ) OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid quota request metric: %', p_resource;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = p_tenant_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Tenant membership required';
  END IF;

  -- Get active tenant plan & custom overrides
  SELECT COALESCE(subscription_plan, 'free'), quota_limits 
    INTO v_plan, v_custom_limits 
    FROM public.tenants 
   WHERE id = p_tenant_id;

  -- Check if custom limit explicitly defined in quota_limits
  IF v_custom_limits IS NOT NULL AND v_custom_limits ? (p_resource || 'PerDay') THEN
    v_limit := (v_custom_limits ->> (p_resource || 'PerDay'))::integer;
  ELSE
    -- Default limit resolution matrix based on plan
    CASE LOWER(v_plan)
      WHEN 'enterprise' THEN v_limit := -1;
      WHEN 'pro' THEN
        v_limit := CASE p_resource
          WHEN 'leads' THEN 500
          WHEN 'outreach_actions' THEN 500
          WHEN 'linkedin_posts' THEN 10
          WHEN 'facebook_posts' THEN 10
          WHEN 'instagram_posts' THEN 10
          WHEN 'email_actions' THEN 750
          WHEN 'mcp_executions' THEN 1500
          WHEN 'contracts' THEN 50
          WHEN 'invoices' THEN 500
          ELSE 500
        END;
      WHEN 'starter' THEN
        v_limit := CASE p_resource
          WHEN 'leads' THEN 100
          WHEN 'outreach_actions' THEN 100
          WHEN 'linkedin_posts' THEN 3
          WHEN 'facebook_posts' THEN 3
          WHEN 'instagram_posts' THEN 3
          WHEN 'email_actions' THEN 150
          WHEN 'mcp_executions' THEN 250
          WHEN 'contracts' THEN 15
          WHEN 'invoices' THEN 100
          ELSE 100
        END;
      ELSE -- 'free' or unknown fallback
        v_limit := CASE p_resource
          WHEN 'leads' THEN 50
          WHEN 'outreach_actions' THEN 20
          WHEN 'linkedin_posts' THEN 1
          WHEN 'facebook_posts' THEN 1
          WHEN 'instagram_posts' THEN 1
          WHEN 'email_actions' THEN 25
          WHEN 'mcp_executions' THEN 50
          WHEN 'contracts' THEN 4
          WHEN 'invoices' THEN 30
          ELSE 30
        END;
    END CASE;
  END IF;

  -- Ensure today's row exists (UTC date window)
  INSERT INTO public.quota_usage (tenant_id, user_id, date)
  VALUES (p_tenant_id, p_user_id, (now() AT TIME ZONE 'UTC')::date)
  ON CONFLICT (tenant_id, user_id, date) DO NOTHING;

  -- Acquire row-level write lock to prevent race conditions
  SELECT * INTO v_row FROM public.quota_usage
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = (now() AT TIME ZONE 'UTC')::date
    FOR UPDATE;

  -- Determine current usage
  v_current := CASE p_resource
    WHEN 'leads' THEN v_row.leads
    WHEN 'outreach_actions' THEN v_row.outreach_actions
    WHEN 'linkedin_posts' THEN v_row.linkedin_posts
    WHEN 'facebook_posts' THEN v_row.facebook_posts
    WHEN 'instagram_posts' THEN v_row.instagram_posts
    WHEN 'email_actions' THEN v_row.email_actions
    WHEN 'mcp_executions' THEN v_row.mcp_executions
    WHEN 'contracts' THEN v_row.contracts
    WHEN 'invoices' THEN v_row.invoices
    ELSE v_row.receipts
  END;

  -- Enforce hard limit if not unlimited (-1)
  IF v_limit >= 0 AND v_current + p_amount > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'currentUsage', v_current, 
      'limit', v_limit, 
      'remaining', GREATEST(v_limit - v_current, 0),
      'plan', v_plan
    );
  END IF;

  -- Increment daily metric count
  UPDATE public.quota_usage SET
    leads = leads + CASE WHEN p_resource = 'leads' THEN p_amount ELSE 0 END,
    outreach_actions = outreach_actions + CASE WHEN p_resource = 'outreach_actions' THEN p_amount ELSE 0 END,
    linkedin_posts = linkedin_posts + CASE WHEN p_resource = 'linkedin_posts' THEN p_amount ELSE 0 END,
    facebook_posts = facebook_posts + CASE WHEN p_resource = 'facebook_posts' THEN p_amount ELSE 0 END,
    instagram_posts = instagram_posts + CASE WHEN p_resource = 'instagram_posts' THEN p_amount ELSE 0 END,
    email_actions = email_actions + CASE WHEN p_resource = 'email_actions' THEN p_amount ELSE 0 END,
    mcp_executions = mcp_executions + CASE WHEN p_resource = 'mcp_executions' THEN p_amount ELSE 0 END,
    contracts = contracts + CASE WHEN p_resource = 'contracts' THEN p_amount ELSE 0 END,
    invoices = invoices + CASE WHEN p_resource = 'invoices' THEN p_amount ELSE 0 END,
    receipts = receipts + CASE WHEN p_resource = 'receipts' THEN p_amount ELSE 0 END,
    updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'allowed', true, 
    'currentUsage', v_current + p_amount, 
    'limit', v_limit, 
    'remaining', CASE WHEN v_limit < 0 THEN -1 ELSE GREATEST(v_limit - v_current - p_amount, 0) END,
    'plan', v_plan
  );
END;
$$;

-- 4. Atomic daily quota release RPC function (for failed transactions)
CREATE OR REPLACE FUNCTION public.release_daily_resource_quota(
  p_tenant_id uuid,
  p_user_id uuid,
  p_resource text,
  p_amount integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_resource NOT IN (
    'leads', 'outreach_actions', 'linkedin_posts', 'facebook_posts', 
    'instagram_posts', 'email_actions', 'mcp_executions',
    'contracts', 'invoices', 'receipts'
  ) OR p_amount <= 0 THEN RETURN; END IF;

  UPDATE public.quota_usage SET
    leads = GREATEST(0, leads - CASE WHEN p_resource = 'leads' THEN p_amount ELSE 0 END),
    outreach_actions = GREATEST(0, outreach_actions - CASE WHEN p_resource = 'outreach_actions' THEN p_amount ELSE 0 END),
    linkedin_posts = GREATEST(0, linkedin_posts - CASE WHEN p_resource = 'linkedin_posts' THEN p_amount ELSE 0 END),
    facebook_posts = GREATEST(0, facebook_posts - CASE WHEN p_resource = 'facebook_posts' THEN p_amount ELSE 0 END),
    instagram_posts = GREATEST(0, instagram_posts - CASE WHEN p_resource = 'instagram_posts' THEN p_amount ELSE 0 END),
    email_actions = GREATEST(0, email_actions - CASE WHEN p_resource = 'email_actions' THEN p_amount ELSE 0 END),
    mcp_executions = GREATEST(0, mcp_executions - CASE WHEN p_resource = 'mcp_executions' THEN p_amount ELSE 0 END),
    contracts = GREATEST(0, contracts - CASE WHEN p_resource = 'contracts' THEN p_amount ELSE 0 END),
    invoices = GREATEST(0, invoices - CASE WHEN p_resource = 'invoices' THEN p_amount ELSE 0 END),
    receipts = GREATEST(0, receipts - CASE WHEN p_resource = 'receipts' THEN p_amount ELSE 0 END),
    updated_at = now()
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = (now() AT TIME ZONE 'UTC')::date;
END;
$$;

-- Function Execution Permissions
REVOKE ALL ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) TO service_role, authenticated;
