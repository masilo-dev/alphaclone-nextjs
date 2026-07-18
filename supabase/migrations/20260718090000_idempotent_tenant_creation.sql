-- Make workspace creation atomic and retry-safe. Only trusted server code may
-- invoke the mutation; browser clients use /api/tenant/bootstrap.

CREATE TABLE IF NOT EXISTS public.tenant_creation_requests (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_creation_requests_tenant_id
    ON public.tenant_creation_requests (tenant_id);

ALTER TABLE public.tenant_creation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_creation_requests_select_own
    ON public.tenant_creation_requests;
CREATE POLICY tenant_creation_requests_select_own
    ON public.tenant_creation_requests
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.tenant_creation_requests
    FROM anon, authenticated;

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

    -- Serialize retries for this user/key pair before checking or mutating.
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

    UPDATE public.tenants
       SET subscription_plan = v_plan,
           subscription_status = CASE WHEN v_plan = 'free' THEN 'active' ELSE 'trial' END,
           trial_ends_at = CASE WHEN v_plan = 'free' THEN NULL ELSE now() + interval '14 days' END,
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

REVOKE ALL ON FUNCTION public.create_tenant(TEXT, TEXT, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant(TEXT, TEXT, UUID, TEXT)
    TO service_role;

REVOKE ALL ON FUNCTION public.create_tenant_idempotent(TEXT, TEXT, UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_idempotent(TEXT, TEXT, UUID, TEXT, TEXT)
    TO service_role;

