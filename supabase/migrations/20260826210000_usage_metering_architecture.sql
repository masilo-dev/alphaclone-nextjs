-- Usage metering architecture: legacy access, trial premium, validate-only checks, idempotent recording.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_access_until timestamptz;

COMMENT ON COLUMN public.tenants.trial_started_at IS 'When the 14-day premium trial began';
COMMENT ON COLUMN public.tenants.legacy_access_until IS 'Pre-rollout accounts remain unrestricted until this instant (UTC)';

-- Pre-rollout workspaces: unrestricted until 31 Aug 2026 23:59:59 UTC
UPDATE public.tenants
   SET legacy_access_until = '2026-08-31 23:59:59+00'::timestamptz
 WHERE created_at < '2026-08-24 00:00:00+00'::timestamptz
   AND legacy_access_until IS NULL;

UPDATE public.tenants
   SET trial_started_at = COALESCE(trial_started_at, created_at)
 WHERE subscription_status = 'trial'
   AND trial_started_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_usage_events_operation_id_unique
  ON public.tenant_usage_events (tenant_id, operation_id)
  WHERE operation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_tenant_quota_limit(
  p_tenant_id uuid,
  p_resource text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_status text;
  v_custom_limits jsonb;
  v_limit integer;
  v_normalized text;
  v_trial_ends timestamptz;
  v_legacy_until timestamptz;
BEGIN
  SELECT COALESCE(subscription_plan, 'free'),
         COALESCE(subscription_status, 'free'),
         quota_limits,
         trial_ends_at,
         legacy_access_until
    INTO v_plan, v_status, v_custom_limits, v_trial_ends, v_legacy_until
    FROM public.tenants
   WHERE id = p_tenant_id;

  IF v_legacy_until IS NOT NULL AND now() <= v_legacy_until THEN
    RETURN jsonb_build_object('limit', -1, 'unlimited', true, 'plan', v_plan, 'reason', 'legacy_access');
  END IF;

  IF lower(v_status) = 'trial' AND v_trial_ends IS NOT NULL AND now() <= v_trial_ends THEN
    RETURN jsonb_build_object('limit', -1, 'unlimited', true, 'plan', v_plan, 'reason', 'trial_premium');
  END IF;

  v_normalized := lower(COALESCE(v_plan, 'free'));
  IF v_normalized IN ('enterprise', 'premium', 'custom') THEN
    v_limit := -1;
  ELSIF v_custom_limits IS NOT NULL AND v_custom_limits ? (p_resource || 'PerDay') THEN
    v_limit := (v_custom_limits ->> (p_resource || 'PerDay'))::integer;
  ELSIF v_normalized IN ('pro', 'starter') THEN
    v_limit := 300;
  ELSE
    v_limit := 50;
  END IF;

  RETURN jsonb_build_object(
    'limit', v_limit,
    'unlimited', v_limit < 0,
    'plan', v_plan,
    'reason', 'plan_limit'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_daily_resource_quota(
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
  v_limit_info jsonb;
  v_limit integer;
  v_current integer;
  v_plan text;
BEGIN
  IF p_resource NOT IN (
    'leads', 'outreach_actions', 'linkedin_posts', 'facebook_posts',
    'instagram_posts', 'email_actions', 'emails_sent', 'email_replies', 'email_transactional',
    'mcp_executions', 'contracts', 'invoices', 'receipts'
  ) OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid quota check metric: %', p_resource;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = p_tenant_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Tenant membership required';
  END IF;

  v_limit_info := public.resolve_tenant_quota_limit(p_tenant_id, p_resource);
  v_limit := (v_limit_info ->> 'limit')::integer;
  v_plan := v_limit_info ->> 'plan';

  IF (v_limit_info ->> 'unlimited')::boolean THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'currentUsage', 0,
      'limit', -1,
      'remaining', -1,
      'plan', v_plan,
      'unlimited', true
    );
  END IF;

  SELECT * INTO v_row FROM public.quota_usage
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = (now() AT TIME ZONE 'UTC')::date;

  v_current := CASE p_resource
    WHEN 'leads' THEN COALESCE(v_row.leads, 0)
    WHEN 'outreach_actions' THEN COALESCE(v_row.outreach_actions, 0)
    WHEN 'linkedin_posts' THEN COALESCE(v_row.linkedin_posts, 0)
    WHEN 'facebook_posts' THEN COALESCE(v_row.facebook_posts, 0)
    WHEN 'instagram_posts' THEN COALESCE(v_row.instagram_posts, 0)
    WHEN 'email_actions' THEN COALESCE(v_row.email_actions, 0)
    WHEN 'emails_sent' THEN COALESCE(v_row.emails_sent, 0)
    WHEN 'email_replies' THEN COALESCE(v_row.email_replies, 0)
    WHEN 'email_transactional' THEN COALESCE(v_row.email_transactional, 0)
    WHEN 'mcp_executions' THEN COALESCE(v_row.mcp_executions, 0)
    WHEN 'contracts' THEN COALESCE(v_row.contracts, 0)
    WHEN 'invoices' THEN COALESCE(v_row.invoices, 0)
    ELSE COALESCE(v_row.receipts, 0)
  END;

  IF v_limit >= 0 AND v_current + p_amount > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'currentUsage', v_current,
      'limit', v_limit,
      'remaining', GREATEST(v_limit - v_current, 0),
      'plan', v_plan,
      'unlimited', false,
      'message', format('Daily limit would be exceeded (%s/%s)', v_current + p_amount, v_limit)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'currentUsage', v_current,
    'limit', v_limit,
    'remaining', GREATEST(v_limit - v_current - p_amount, 0),
    'plan', v_plan,
    'unlimited', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_metered_usage_idempotent(
  p_tenant_id uuid,
  p_user_id uuid,
  p_resource text,
  p_amount integer DEFAULT 1,
  p_operation_id text DEFAULT NULL,
  p_initiation_source text DEFAULT 'api'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_consume jsonb;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('charged', false, 'alreadyRecorded', false, 'amount', 0);
  END IF;

  IF p_operation_id IS NOT NULL AND length(trim(p_operation_id)) > 0 THEN
    SELECT id INTO v_existing
      FROM public.tenant_usage_events
     WHERE tenant_id = p_tenant_id
       AND operation_id = p_operation_id
       AND quota_charged = true
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'charged', false,
        'alreadyRecorded', true,
        'operationId', p_operation_id
      );
    END IF;
  END IF;

  v_consume := public.consume_daily_resource_quota(p_tenant_id, p_user_id, p_resource, p_amount);

  IF COALESCE((v_consume ->> 'allowed')::boolean, false) THEN
    INSERT INTO public.tenant_usage_events (
      tenant_id, user_id, operation_id, initiation_source, business_action,
      success, quota_charged, quota_reason, metadata
    ) VALUES (
      p_tenant_id,
      p_user_id,
      NULLIF(trim(p_operation_id), ''),
      COALESCE(NULLIF(trim(p_initiation_source), ''), 'api'),
      p_resource,
      true,
      true,
      format('Recorded %s x %s after successful persistence', p_amount, p_resource),
      jsonb_build_object('resource', p_resource, 'amount', p_amount)
    );
  END IF;

  RETURN v_consume || jsonb_build_object(
    'charged', COALESCE((v_consume ->> 'allowed')::boolean, false),
    'alreadyRecorded', false,
    'operationId', p_operation_id
  );
END;
$$;

-- Rebuild consume_daily_resource_quota to use shared limit resolver (legacy + trial premium)
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
  v_limit_info jsonb;
  v_limit integer;
  v_current integer;
  v_plan text;
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

  v_limit_info := public.resolve_tenant_quota_limit(p_tenant_id, p_resource);
  v_limit := (v_limit_info ->> 'limit')::integer;
  v_plan := v_limit_info ->> 'plan';

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

GRANT EXECUTE ON FUNCTION public.resolve_tenant_quota_limit(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_daily_resource_quota(uuid, uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_metered_usage_idempotent(uuid, uuid, text, integer, text, text) TO authenticated, service_role;
