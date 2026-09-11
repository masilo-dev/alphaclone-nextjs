CREATE OR REPLACE FUNCTION public.create_tenant(
    p_name VARCHAR(200),
    p_slug VARCHAR(100),
    p_admin_user_id UUID,
    p_plan VARCHAR(50) DEFAULT 'free'
) RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_slug_base TEXT;
    v_slug TEXT;
    v_attempt INT := 0;
    v_suffix TEXT;
BEGIN
    v_slug_base := lower(coalesce(nullif(p_slug, ''), p_name));
    v_slug_base := trim(both '-' from regexp_replace(v_slug_base, '[^a-z-]+', '-', 'g'));
    v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');
    IF v_slug_base = '' THEN
        v_slug_base := 'workspace';
    END IF;
    v_slug_base := left(v_slug_base, 72);
    v_slug := v_slug_base;

    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
        v_attempt := v_attempt + 1;
        v_suffix := substring(regexp_replace(md5(random()::text), '[^a-z]+', '', 'g') from 1 for 5);
        IF v_suffix IS NULL OR v_suffix = '' THEN
            v_suffix := 'alpha';
        END IF;
        v_slug := left(v_slug_base, 72 - length(v_suffix) - 1)
                  || '-' || v_suffix;
        IF v_attempt > 50 THEN
            RAISE EXCEPTION 'Unable to generate unique workspace slug';
        END IF;
    END LOOP;

    INSERT INTO public.tenants (name, slug, subscription_plan, subscription_status, trial_ends_at)
    VALUES (p_name, v_slug, coalesce(p_plan, 'free'), 'trial', (now() + interval '14 days'))
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

    BEGIN
        PERFORM public.publish_event(
            'tenant.created',
            'tenant_service',
            jsonb_build_object(
                'tenantId',    v_tenant_id,
                'name',        p_name,
                'adminUserId', p_admin_user_id
            ),
            '{}',
            v_tenant_id
        );
    EXCEPTION
        WHEN undefined_function OR undefined_table OR insufficient_privilege THEN
            NULL;
    END;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_tenant(VARCHAR, VARCHAR, UUID, VARCHAR)
    TO authenticated;
