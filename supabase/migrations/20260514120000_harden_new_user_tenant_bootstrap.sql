-- Harden new-user tenant bootstrap and activity tracking.
-- New signups must receive a tenant membership before dashboard tenant-scoped
-- queries run; login/activity rows must not fail when they happen during that
-- short bootstrap window.

-- ============================================================
-- 1. Add soft-delete flag to tenants
-- ============================================================

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS deletion_pending_at TIMESTAMPTZ;

-- ============================================================
-- 2. Recreate create_tenant (idempotent slug generation,
--    bootstrap-safe membership insert)
-- ============================================================

-- Drop both possible overload signatures that prior migrations may have left.
-- NOTE: PG normalises VARCHAR(n) → character varying, so these two DROPs
-- cover the old sized signature (20260404_fix_create_tenant_function.sql)
-- and any untyped version simultaneously.
DROP FUNCTION IF EXISTS public.create_tenant(VARCHAR, VARCHAR, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION public.create_tenant(
    p_name         VARCHAR,
    p_slug         VARCHAR,
    p_admin_user_id UUID,
    p_plan         VARCHAR DEFAULT 'free'
) RETURNS UUID AS $$
DECLARE
    v_tenant_id  UUID;
    v_slug_base  TEXT;
    v_slug       TEXT;
    v_suffix     INT := 0;
BEGIN
    -- Callers must act on behalf of themselves (service-role bypass is fine
    -- because auth.uid() returns NULL in that context).
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

    -- Ensure slug uniqueness
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
        v_suffix := v_suffix + 1;
        v_slug := left(v_slug_base, 72 - length(v_suffix::TEXT) - 1)
                  || '-' || v_suffix::TEXT;
    END LOOP;

    -- Create tenant
    INSERT INTO public.tenants (name, slug, subscription_plan, subscription_status)
    VALUES (p_name, v_slug, coalesce(p_plan, 'free'), 'active')
    RETURNING id INTO v_tenant_id;

    -- Bootstrap membership BEFORE any tenant-scoped queries can run
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_admin_user_id, 'tenant_admin')
    ON CONFLICT (tenant_id, user_id) DO UPDATE
        SET role = EXCLUDED.role;

    -- Fire event if the helper exists; swallow any error so the bootstrap
    -- succeeds even if publish_event hasn't been deployed or has a different
    -- signature (42883 = undefined_function covers wrong-arg-count too).
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
            NULL; -- non-fatal: event bus is optional
    END;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_tenant(VARCHAR, VARCHAR, UUID, VARCHAR)
    TO authenticated;

-- ============================================================
-- 3. get_user_tenants – filters out soft-deleted tenants
-- ============================================================

DROP FUNCTION IF EXISTS public.get_user_tenants(UUID);

CREATE OR REPLACE FUNCTION public.get_user_tenants(p_user_id UUID)
RETURNS TABLE (
    id                  UUID,
    name                VARCHAR,
    slug                VARCHAR,
    domain              VARCHAR,
    logo_url            TEXT,
    settings            JSONB,
    subscription_plan   VARCHAR,
    subscription_status VARCHAR,
    trial_ends_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ,
    role                VARCHAR,
    joined_at           TIMESTAMPTZ
) AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot list tenants for another user';
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.slug,
        t.domain,
        t.logo_url,
        t.settings,
        t.subscription_plan,
        t.subscription_status,
        t.trial_ends_at,
        t.created_at,
        t.updated_at,
        tu.role,
        tu.joined_at
    FROM public.tenants t
    JOIN public.tenant_users tu ON tu.tenant_id = t.id
    WHERE tu.user_id = p_user_id
      AND t.deletion_pending_at IS NULL
    ORDER BY tu.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_user_tenants(UUID) TO authenticated;

-- ============================================================
-- 4. activity_logs – ensure table exists, RLS, and policies
-- ============================================================

-- FIX: table must exist before policies can be created.
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action      TEXT        NOT NULL,
    entity_type TEXT,
    entity_id   UUID,
    metadata    JSONB       DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant
    ON public.activity_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user
    ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created
    ON public.activity_logs (created_at DESC);

-- FIX: RLS must be enabled before policies are meaningful.
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop stale policies so we can recreate them cleanly.
DROP POLICY IF EXISTS "tenant_isolation_policy"  ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.activity_logs;

-- Single SELECT/UPDATE/DELETE policy: own rows OR rows inside user's tenants.
-- This is safe during bootstrap because user_id = auth.uid() passes even
-- before the tenant_users row exists.
CREATE POLICY "tenant_isolation_policy" ON public.activity_logs
FOR ALL
USING (
    user_id = auth.uid()
    OR tenant_id IN (
        SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    -- INSERT/UPDATE: only write your own rows.
    -- FIX: removed the tenant_id OR-branch from WITH CHECK – a brand-new
    -- user has no tenant_users row yet, so that branch would block the
    -- very first log insert during the bootstrap window.
    user_id = auth.uid()
);

-- ============================================================
-- 5. login_sessions – ensure table exists, RLS, and policies
-- ============================================================

-- FIX: table must exist before policies can be created.
CREATE TABLE IF NOT EXISTS public.login_sessions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id      UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
    session_token  TEXT,
    ip_address     INET,
    user_agent     TEXT,
    created_at     TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now(),
    expires_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_login_sessions_user
    ON public.login_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_tenant
    ON public.login_sessions (tenant_id);

-- FIX: enable RLS before attaching policies.
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert/update own sessions" ON public.login_sessions;
DROP POLICY IF EXISTS "tenant_isolation_policy"              ON public.login_sessions;

-- Users can only see and write their own session rows.
-- tenant_id intentionally excluded from USING so a session can be inserted
-- during the bootstrap window (before tenant_users row exists).
CREATE POLICY "Users can insert/update own sessions" ON public.login_sessions
FOR ALL
USING    (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
