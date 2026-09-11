-- Migration: Cleanup Create Tenant Overloads
-- Description: Drops all known overloads of create_tenant to resolve PGRST203 ambiguity.
-- Standardises on TEXT types for PostgREST compatibility.

-- 1. Drop all known signatures
DROP FUNCTION IF EXISTS public.create_tenant(VARCHAR, VARCHAR, UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.create_tenant(VARCHAR(200), VARCHAR(100), UUID, VARCHAR(50));
DROP FUNCTION IF EXISTS public.create_tenant(TEXT, TEXT, UUID, TEXT);

-- 2. Re-create with TEXT types
CREATE OR REPLACE FUNCTION public.create_tenant(
    p_name         TEXT,
    p_slug         TEXT,
    p_admin_user_id UUID,
    p_plan         TEXT DEFAULT 'free'
) RETURNS UUID AS $$
DECLARE
    v_tenant_id  UUID;
    v_slug_base  TEXT;
    v_slug       TEXT;
    v_suffix     INT := 0;
BEGIN
    -- Auth verification
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_admin_user_id THEN
        RAISE EXCEPTION 'Cannot create tenant for another user';
    END IF;

    -- Sanitise slug
    v_slug_base := lower(regexp_replace(
        coalesce(nullif(trim(p_slug), ''), 'workspace'),
        '[^a-z0-9-]+', '-', 'g'
    ));
    v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');
    IF v_slug_base = '' THEN
        v_slug_base := 'workspace';
    END IF;
    v_slug_base := left(v_slug_base, 72);
    v_slug := v_slug_base;

    -- Handle collisions
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
        v_suffix := v_suffix + 1;
        v_slug := left(v_slug_base, 72 - length(v_suffix::TEXT) - 1)
                  || '-' || v_suffix::TEXT;
    END LOOP;

    -- Create tenant record
    INSERT INTO public.tenants (name, slug, subscription_plan, subscription_status)
    VALUES (p_name, v_slug, coalesce(p_plan, 'free'), 'active')
    RETURNING id INTO v_tenant_id;

    -- Direct bootstrap of membership
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_admin_user_id, 'tenant_admin')
    ON CONFLICT (tenant_id, user_id) DO UPDATE
        SET role = EXCLUDED.role;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
