BEGIN;

CREATE TABLE IF NOT EXISTS public.autonomous_runner_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_send_confidence_threshold INTEGER NOT NULL DEFAULT 85 CHECK (auto_send_confidence_threshold BETWEEN 0 AND 100),
    high_risk_approval_required BOOLEAN NOT NULL DEFAULT true,
    stale_deal_days INTEGER NOT NULL DEFAULT 7 CHECK (stale_deal_days >= 1 AND stale_deal_days <= 60),
    social_inactivity_days INTEGER NOT NULL DEFAULT 3 CHECK (social_inactivity_days >= 1 AND social_inactivity_days <= 30),
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.autonomous_runner_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    run_id UUID NULL REFERENCES public.autonomous_runner_runs(id) ON DELETE SET NULL,
    action_key TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    reason TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_runner_approvals_tenant_status
    ON public.autonomous_runner_approvals (tenant_id, status, created_at DESC);

ALTER TABLE public.autonomous_runner_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_runner_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read autonomous runner rules" ON public.autonomous_runner_rules;
CREATE POLICY "Tenant users can read autonomous runner rules"
    ON public.autonomous_runner_rules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_rules.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant admins can write autonomous runner rules" ON public.autonomous_runner_rules;
CREATE POLICY "Tenant admins can write autonomous runner rules"
    ON public.autonomous_runner_rules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_rules.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('tenant_admin', 'admin', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_rules.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('tenant_admin', 'admin', 'owner')
        )
    );

DROP POLICY IF EXISTS "Tenant users can read autonomous runner approvals" ON public.autonomous_runner_approvals;
CREATE POLICY "Tenant users can read autonomous runner approvals"
    ON public.autonomous_runner_approvals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_approvals.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create autonomous runner approvals" ON public.autonomous_runner_approvals;
CREATE POLICY "Tenant users can create autonomous runner approvals"
    ON public.autonomous_runner_approvals
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_approvals.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant admins can update autonomous runner approvals" ON public.autonomous_runner_approvals;
CREATE POLICY "Tenant admins can update autonomous runner approvals"
    ON public.autonomous_runner_approvals
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_approvals.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('tenant_admin', 'admin', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = autonomous_runner_approvals.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('tenant_admin', 'admin', 'owner')
        )
    );

COMMIT;

