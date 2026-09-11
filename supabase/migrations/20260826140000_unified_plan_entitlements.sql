/**
 * Unified plan entitlements: FREE=50, PRO=300, PREMIUM=unlimited (-1).
 * Safe to re-run.
 */

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
  v_normalized text;
BEGIN
  IF p_resource NOT IN (
    'leads', 'outreach_actions', 'linkedin_posts', 'facebook_posts',
    'instagram_posts', 'email_actions', 'emails_sent', 'email_replies', 'email_transactional',
    'mcp_executions', 'contracts', 'invoices', 'receipts'
  ) OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid quota request metric: %', p_resource;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = p_tenant_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Tenant membership required';
  END IF;

  SELECT COALESCE(subscription_plan, 'free'), quota_limits
    INTO v_plan, v_custom_limits
    FROM public.tenants
   WHERE id = p_tenant_id;

  v_normalized := LOWER(COALESCE(v_plan, 'free'));
  IF v_normalized IN ('enterprise', 'premium', 'custom') THEN
    v_limit := -1;
  ELSIF v_custom_limits IS NOT NULL AND v_custom_limits ? (p_resource || 'PerDay') THEN
    v_limit := (v_custom_limits ->> (p_resource || 'PerDay'))::integer;
  ELSIF v_normalized IN ('pro', 'starter') THEN
    v_limit := 300;
  ELSE
    v_limit := 50;
  END IF;

  INSERT INTO public.quota_usage (tenant_id, user_id, date)
  VALUES (p_tenant_id, p_user_id, (now() AT TIME ZONE 'UTC')::date)
  ON CONFLICT (tenant_id, user_id, date) DO NOTHING;

  SELECT * INTO v_row FROM public.quota_usage
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = (now() AT TIME ZONE 'UTC')::date
    FOR UPDATE;

  v_current := CASE p_resource
    WHEN 'leads' THEN v_row.leads
    WHEN 'outreach_actions' THEN v_row.outreach_actions
    WHEN 'linkedin_posts' THEN v_row.linkedin_posts
    WHEN 'facebook_posts' THEN v_row.facebook_posts
    WHEN 'instagram_posts' THEN v_row.instagram_posts
    WHEN 'email_actions' THEN v_row.email_actions
    WHEN 'emails_sent' THEN v_row.emails_sent
    WHEN 'email_replies' THEN v_row.email_replies
    WHEN 'email_transactional' THEN v_row.email_transactional
    WHEN 'mcp_executions' THEN v_row.mcp_executions
    WHEN 'contracts' THEN v_row.contracts
    WHEN 'invoices' THEN v_row.invoices
    ELSE v_row.receipts
  END;

  IF v_limit >= 0 AND v_current + p_amount > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'currentUsage', v_current,
      'limit', v_limit,
      'remaining', GREATEST(v_limit - v_current, 0),
      'plan', v_plan,
      'unlimited', false
    );
  END IF;

  UPDATE public.quota_usage SET
    leads = leads + CASE WHEN p_resource = 'leads' THEN p_amount ELSE 0 END,
    outreach_actions = outreach_actions + CASE WHEN p_resource = 'outreach_actions' THEN p_amount ELSE 0 END,
    linkedin_posts = linkedin_posts + CASE WHEN p_resource = 'linkedin_posts' THEN p_amount ELSE 0 END,
    facebook_posts = facebook_posts + CASE WHEN p_resource = 'facebook_posts' THEN p_amount ELSE 0 END,
    instagram_posts = instagram_posts + CASE WHEN p_resource = 'instagram_posts' THEN p_amount ELSE 0 END,
    email_actions = email_actions + CASE WHEN p_resource = 'email_actions' THEN p_amount ELSE 0 END,
    emails_sent = emails_sent + CASE WHEN p_resource = 'emails_sent' THEN p_amount ELSE 0 END,
    email_replies = email_replies + CASE WHEN p_resource = 'email_replies' THEN p_amount ELSE 0 END,
    email_transactional = email_transactional + CASE WHEN p_resource = 'email_transactional' THEN p_amount ELSE 0 END,
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
    'plan', v_plan,
    'unlimited', v_limit < 0
  );
END;
$$;

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
    'instagram_posts', 'email_actions', 'emails_sent', 'email_replies', 'email_transactional',
    'mcp_executions', 'contracts', 'invoices', 'receipts'
  ) OR p_amount <= 0 THEN RETURN; END IF;

  UPDATE public.quota_usage SET
    leads = GREATEST(0, leads - CASE WHEN p_resource = 'leads' THEN p_amount ELSE 0 END),
    outreach_actions = GREATEST(0, outreach_actions - CASE WHEN p_resource = 'outreach_actions' THEN p_amount ELSE 0 END),
    linkedin_posts = GREATEST(0, linkedin_posts - CASE WHEN p_resource = 'linkedin_posts' THEN p_amount ELSE 0 END),
    facebook_posts = GREATEST(0, facebook_posts - CASE WHEN p_resource = 'facebook_posts' THEN p_amount ELSE 0 END),
    instagram_posts = GREATEST(0, instagram_posts - CASE WHEN p_resource = 'instagram_posts' THEN p_amount ELSE 0 END),
    email_actions = GREATEST(0, email_actions - CASE WHEN p_resource = 'email_actions' THEN p_amount ELSE 0 END),
    emails_sent = GREATEST(0, emails_sent - CASE WHEN p_resource = 'emails_sent' THEN p_amount ELSE 0 END),
    email_replies = GREATEST(0, email_replies - CASE WHEN p_resource = 'email_replies' THEN p_amount ELSE 0 END),
    email_transactional = GREATEST(0, email_transactional - CASE WHEN p_resource = 'email_transactional' THEN p_amount ELSE 0 END),
    mcp_executions = GREATEST(0, mcp_executions - CASE WHEN p_resource = 'mcp_executions' THEN p_amount ELSE 0 END),
    contracts = GREATEST(0, contracts - CASE WHEN p_resource = 'contracts' THEN p_amount ELSE 0 END),
    invoices = GREATEST(0, invoices - CASE WHEN p_resource = 'invoices' THEN p_amount ELSE 0 END),
    receipts = GREATEST(0, receipts - CASE WHEN p_resource = 'receipts' THEN p_amount ELSE 0 END),
    updated_at = now()
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = (now() AT TIME ZONE 'UTC')::date;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) TO service_role, authenticated;
