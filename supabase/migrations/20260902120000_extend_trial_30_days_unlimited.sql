-- Extend trial to 30 days and grant active trial tenants at least 30 days from now.
-- Daily MCP/email quotas remain unlimited during trial via resolve_tenant_quota_limit.

UPDATE public.tenants
SET
  trial_ends_at = GREATEST(
    COALESCE(trial_ends_at, now()),
    now() + interval '30 days'
  ),
  updated_at = now()
WHERE subscription_status = 'trial';

-- New signups: 30-day trial window (override create_tenant_idempotent trial interval).
CREATE OR REPLACE FUNCTION public.create_tenant_idempotent(
    p_name TEXT,
    p_slug TEXT,
    p_admin_user_id UUID,
    p_plan TEXT DEFAULT 'pro',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key TEXT := COALESCE(NULLIF(trim(p_idempotency_key), ''), gen_random_uuid()::text);
    v_tenant_id UUID;
    v_plan TEXT := COALESCE(NULLIF(trim(p_plan), ''), 'pro');
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_creation_requests
    WHERE user_id = p_admin_user_id AND idempotency_key = v_key
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;

    v_tenant_id := public.create_tenant(
        p_name,
        p_slug,
        p_admin_user_id,
        v_plan
    );

    UPDATE public.tenants
       SET subscription_plan = v_plan,
           subscription_status = CASE WHEN v_plan = 'free' THEN 'active' ELSE 'trial' END,
           trial_ends_at = CASE WHEN v_plan = 'free' THEN NULL ELSE now() + interval '30 days' END,
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

REVOKE ALL ON FUNCTION public.create_tenant_idempotent(TEXT, TEXT, UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_idempotent(TEXT, TEXT, UUID, TEXT, TEXT)
    TO service_role;
