-- Universal 14-day trial: no card required at signup. All new workspaces start
-- on trial; free-intent signups receive Pro execution power for the trial window.

CREATE OR REPLACE FUNCTION public.create_tenant_idempotent(
    p_name TEXT,
    p_slug TEXT,
    p_admin_user_id UUID,
    p_plan TEXT DEFAULT 'free',
    p_idempotency_key TEXT DEFAULT 'initial-workspace-v1'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_plan TEXT := lower(coalesce(nullif(trim(p_plan), ''), 'free'));
    v_key TEXT := trim(coalesce(p_idempotency_key, ''));
    v_effective_plan TEXT;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_admin_user_id THEN
        RAISE EXCEPTION 'Cannot create a workspace for another user';
    END IF;

    IF char_length(v_key) < 8 OR char_length(v_key) > 200 THEN
        RAISE EXCEPTION 'Invalid idempotency key';
    END IF;

    IF v_plan NOT IN ('free', 'starter', 'pro', 'enterprise') THEN
        RAISE EXCEPTION 'Invalid subscription plan';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_admin_user_id::TEXT || ':' || v_key, 0)
    );

    SELECT request.tenant_id
      INTO v_tenant_id
      FROM public.tenant_creation_requests AS request
     WHERE request.user_id = p_admin_user_id
       AND request.idempotency_key = v_key;

    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;

    v_tenant_id := public.create_tenant(
        p_name,
        p_slug,
        p_admin_user_id,
        v_plan
    );

    -- Free signups receive Pro execution during the trial; paid-intent keeps chosen plan.
    v_effective_plan := CASE
        WHEN v_plan = 'free' THEN 'pro'
        ELSE v_plan
    END;

    UPDATE public.tenants
       SET subscription_plan = v_effective_plan,
           subscription_status = 'trial',
           trial_ends_at = now() + interval '14 days',
           updated_at = now()
     WHERE id = v_tenant_id;

    INSERT INTO public.tenant_creation_requests (
        user_id,
        idempotency_key,
        tenant_id
    ) VALUES (
        p_admin_user_id,
        v_key,
        v_tenant_id
    );

    RETURN v_tenant_id;
END;
$$;

-- Refresh existing workspaces without an active Stripe subscription to the new
-- 14-day trial window starting from deployment (Aug 24, 2026 policy).
UPDATE public.tenants
   SET subscription_status = 'trial',
       trial_ends_at = now() + interval '14 days',
       subscription_plan = CASE
           WHEN subscription_plan = 'free' THEN 'pro'
           ELSE subscription_plan
       END,
       updated_at = now()
 WHERE stripe_subscription_id IS NULL
   AND coalesce(subscription_status, 'free') IN ('trial', 'active', 'free');
