BEGIN;

CREATE TABLE IF NOT EXISTS public.bonnie_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    run_id UUID NULL REFERENCES public.autonomous_runner_runs(id) ON DELETE SET NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'success', 'error')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_logs_tenant_created_at
    ON public.bonnie_logs (tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.bonnie_logs ENABLE ROW LEVEL SECURITY;

-- Select policy: Tenant users can read logs
DROP POLICY IF EXISTS "Tenant users can read bonnie logs" ON public.bonnie_logs;
CREATE POLICY "Tenant users can read bonnie logs"
    ON public.bonnie_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = bonnie_logs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

-- Insert policy: Tenant users can insert logs
DROP POLICY IF EXISTS "Tenant users can insert bonnie logs" ON public.bonnie_logs;
CREATE POLICY "Tenant users can insert bonnie logs"
    ON public.bonnie_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = bonnie_logs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

COMMIT;
