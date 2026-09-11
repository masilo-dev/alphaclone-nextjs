BEGIN;

CREATE TABLE IF NOT EXISTS public.autonomous_runner_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial_success', 'failed')),
    trigger_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_runner_runs_tenant_created_at
    ON public.autonomous_runner_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.autonomous_runner_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.autonomous_runner_runs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    details TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_runner_actions_run_id
    ON public.autonomous_runner_actions (run_id, created_at DESC);

ALTER TABLE public.autonomous_runner_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_runner_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read autonomous runner runs" ON public.autonomous_runner_runs;
CREATE POLICY "Tenant users can read autonomous runner runs"
    ON public.autonomous_runner_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_runs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create autonomous runner runs" ON public.autonomous_runner_runs;
CREATE POLICY "Tenant users can create autonomous runner runs"
    ON public.autonomous_runner_runs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_runs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can update autonomous runner runs" ON public.autonomous_runner_runs;
CREATE POLICY "Tenant users can update autonomous runner runs"
    ON public.autonomous_runner_runs
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_runs.tenant_id
              AND tu.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_runs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can read autonomous runner actions" ON public.autonomous_runner_actions;
CREATE POLICY "Tenant users can read autonomous runner actions"
    ON public.autonomous_runner_actions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_actions.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create autonomous runner actions" ON public.autonomous_runner_actions;
CREATE POLICY "Tenant users can create autonomous runner actions"
    ON public.autonomous_runner_actions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_actions.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

COMMIT;

