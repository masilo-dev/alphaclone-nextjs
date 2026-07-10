-- Resolve create_tenant overload ambiguity (PGRST203) and ensure GRANT for authenticated users.

DROP FUNCTION IF EXISTS public.create_tenant(VARCHAR, VARCHAR, UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.create_tenant(VARCHAR(200), VARCHAR(100), UUID, VARCHAR(50));
DROP FUNCTION IF EXISTS public.create_tenant(TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.create_tenant(
    p_name TEXT,
    p_slug TEXT,
    p_admin_user_id UUID,
    p_plan TEXT DEFAULT 'free'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_slug_base TEXT;
    v_slug TEXT;
    v_suffix INT := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_admin_user_id THEN
        RAISE EXCEPTION 'Cannot create tenant for another user';
    END IF;

    v_slug_base := lower(regexp_replace(coalesce(nullif(trim(p_slug), ''), 'workspace'), '[^a-z0-9-]+', '-', 'g'));
    v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');
    IF v_slug_base = '' THEN
        v_slug_base := 'workspace';
    END IF;
    v_slug_base := left(v_slug_base, 72);
    v_slug := v_slug_base;

    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
        v_suffix := v_suffix + 1;
        v_slug := left(v_slug_base, 72 - length(v_suffix::TEXT) - 1) || '-' || v_suffix::TEXT;
        IF v_suffix > 80 THEN
            RAISE EXCEPTION 'Unable to generate unique workspace slug';
        END IF;
    END LOOP;

    INSERT INTO public.tenants (name, slug, subscription_plan, subscription_status, trial_ends_at)
    VALUES (
        p_name,
        v_slug,
        coalesce(p_plan, 'free'),
        'trial',
        now() + interval '14 days'
    )
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_admin_user_id, 'tenant_admin')
    ON CONFLICT (tenant_id, user_id) DO UPDATE
        SET role = EXCLUDED.role;

    BEGIN
        INSERT INTO public.business_automation_events (tenant_id, event_type, payload)
        VALUES (
            v_tenant_id,
            'tenant_created',
            jsonb_build_object(
                'tenantId', v_tenant_id,
                'name', p_name,
                'adminUserId', p_admin_user_id
            )
        );
    EXCEPTION
        WHEN undefined_table OR insufficient_privilege THEN
            NULL;
    END;

    RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant(TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant(TEXT, TEXT, UUID, TEXT) TO service_role;
