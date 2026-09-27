BEGIN;

CREATE TABLE IF NOT EXISTS public.deferred_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending_provider' CHECK (status IN ('pending_provider', 'retrying', 'failed', 'completed')),
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deferred_actions_tenant_status
    ON public.deferred_actions (tenant_id, status, created_at DESC);

ALTER TABLE public.deferred_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read deferred actions" ON public.deferred_actions;
CREATE POLICY "Tenant users can read deferred actions"
    ON public.deferred_actions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = deferred_actions.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create deferred actions" ON public.deferred_actions;
CREATE POLICY "Tenant users can create deferred actions"
    ON public.deferred_actions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = deferred_actions.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant admins can update deferred actions" ON public.deferred_actions;
CREATE POLICY "Tenant admins can update deferred actions"
    ON public.deferred_actions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = deferred_actions.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('tenant_admin', 'admin', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = deferred_actions.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('tenant_admin', 'admin', 'owner')
        )
    );

COMMIT;
