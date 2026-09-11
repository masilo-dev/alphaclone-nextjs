-- ============================================================
-- Fix: contract_versions missing tenant_id + contract_approvals missing
-- Apply this in: Supabase Dashboard → SQL Editor
-- Or via: supabase db push (if Supabase CLI is linked)
-- ============================================================

-- 1. Add tenant_id to contract_versions if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_versions'
          AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.contract_versions
            ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

        -- Back-fill tenant_id from parent contracts
        UPDATE public.contract_versions cv
        SET tenant_id = c.tenant_id
        FROM public.contracts c
        WHERE cv.contract_id = c.id
          AND cv.tenant_id IS NULL;

        RAISE NOTICE 'tenant_id added to contract_versions and back-filled';
    ELSE
        RAISE NOTICE 'tenant_id already exists on contract_versions';
    END IF;
END
$$;

-- 2. RLS for contract_versions
ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contract_versions_read" ON public.contract_versions;
CREATE POLICY "tenant_contract_versions_read"
    ON public.contract_versions FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_versions_manage" ON public.contract_versions;
CREATE POLICY "tenant_contract_versions_manage"
    ON public.contract_versions FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_contract_versions_tenant_contract
    ON public.contract_versions (tenant_id, contract_id, version_number DESC);

-- 3. Create contract_approvals table (fully idempotent)
CREATE TABLE IF NOT EXISTS public.contract_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    contract_version_id UUID REFERENCES public.contract_versions(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    request_note TEXT,
    decision_note TEXT,
    due_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contract_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contract_approvals_read" ON public.contract_approvals;
CREATE POLICY "tenant_contract_approvals_read"
    ON public.contract_approvals FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_approvals_manage" ON public.contract_approvals;
CREATE POLICY "tenant_contract_approvals_manage"
    ON public.contract_approvals FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid() AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_contract_approvals_tenant_status
    ON public.contract_approvals (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_approvals_contract_version
    ON public.contract_approvals (contract_id, contract_version_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_contract_approvals_updated_at ON public.contract_approvals;
CREATE TRIGGER trg_contract_approvals_updated_at
    BEFORE UPDATE ON public.contract_approvals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify schema cache to refresh (PostgREST)
NOTIFY pgrst, 'reload schema';
