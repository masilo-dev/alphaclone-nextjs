BEGIN;

CREATE TABLE IF NOT EXISTS public.reconciliation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    statement_start_date DATE NOT NULL,
    statement_end_date DATE NOT NULL,
    statement_ending_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    cleared_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    discrepancy_amount DECIMAL(15,2) GENERATED ALWAYS AS (statement_ending_balance - cleared_balance) STORED,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reconciliation_sessions_date_range_check CHECK (statement_end_date >= statement_start_date)
);

ALTER TABLE IF EXISTS public.bank_transactions
    ADD COLUMN IF NOT EXISTS reconciliation_session_id UUID REFERENCES public.reconciliation_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_sessions_tenant
    ON public.reconciliation_sessions (tenant_id, status, statement_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciliation_session
    ON public.bank_transactions (reconciliation_session_id)
    WHERE reconciliation_session_id IS NOT NULL;

ALTER TABLE public.reconciliation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_reconciliation_sessions" ON public.reconciliation_sessions;
CREATE POLICY "tenant_reconciliation_sessions"
    ON public.reconciliation_sessions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

CREATE TABLE IF NOT EXISTS public.contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'service',
    description TEXT,
    content TEXT NOT NULL,
    output_format TEXT NOT NULL DEFAULT 'html'
      CHECK (output_format IN ('html', 'markdown', 'text')),
    approval_required BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.contract_templates
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'service',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS content TEXT,
    ADD COLUMN IF NOT EXISTS output_format TEXT NOT NULL DEFAULT 'html',
    ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contract_templates_read" ON public.contract_templates;
CREATE POLICY "tenant_contract_templates_read"
    ON public.contract_templates
    FOR SELECT
    USING (
        tenant_id IS NULL
        OR tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_templates_manage" ON public.contract_templates;
CREATE POLICY "tenant_contract_templates_manage"
    ON public.contract_templates
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE TABLE IF NOT EXISTS public.contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64),
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'approval_pending', 'approved', 'rejected', 'superseded')),
    change_summary TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, version_number)
);

ALTER TABLE IF EXISTS public.contract_versions
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.contract_versions cv
SET tenant_id = c.tenant_id
FROM public.contracts c
WHERE cv.contract_id = c.id
  AND cv.tenant_id IS NULL;

ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contract_versions_read" ON public.contract_versions;
CREATE POLICY "tenant_contract_versions_read"
    ON public.contract_versions
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_versions_manage" ON public.contract_versions;
CREATE POLICY "tenant_contract_versions_manage"
    ON public.contract_versions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_contract_versions_tenant_contract
    ON public.contract_versions (tenant_id, contract_id, version_number DESC);

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
    ON public.contract_approvals
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "tenant_contract_approvals_manage" ON public.contract_approvals;
CREATE POLICY "tenant_contract_approvals_manage"
    ON public.contract_approvals
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'tenant_admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM public.tenant_users
            WHERE user_id = auth.uid()
              AND role IN ('admin', 'tenant_admin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_contract_approvals_tenant_status
    ON public.contract_approvals (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_approvals_contract_version
    ON public.contract_approvals (contract_id, contract_version_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconciliation_sessions_updated_at ON public.reconciliation_sessions;
CREATE TRIGGER trg_reconciliation_sessions_updated_at
    BEFORE UPDATE ON public.reconciliation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_contract_templates_updated_at ON public.contract_templates;
CREATE TRIGGER trg_contract_templates_updated_at
    BEFORE UPDATE ON public.contract_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_contract_approvals_updated_at ON public.contract_approvals;
CREATE TRIGGER trg_contract_approvals_updated_at
    BEFORE UPDATE ON public.contract_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_accounts_receivable_aging(p_tenant_id UUID)
RETURNS TABLE (
    aging_bucket TEXT,
    invoice_count BIGINT,
    total_amount NUMERIC
)
LANGUAGE sql
AS $$
    WITH normalized AS (
        SELECT
            CASE
                WHEN due_date IS NULL OR due_date >= CURRENT_DATE THEN 'current'
                WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN '1_30'
                WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN '31_60'
                WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN '61_90'
                ELSE '90_plus'
            END AS bucket,
            COALESCE(total, 0)::numeric AS amount
        FROM public.business_invoices
        WHERE tenant_id = p_tenant_id
          AND COALESCE(status, '') IN ('sent', 'overdue', 'partial')
    )
    SELECT
        bucket AS aging_bucket,
        COUNT(*) AS invoice_count,
        COALESCE(SUM(amount), 0) AS total_amount
    FROM normalized
    GROUP BY bucket
    ORDER BY
        CASE bucket
            WHEN 'current' THEN 1
            WHEN '1_30' THEN 2
            WHEN '31_60' THEN 3
            WHEN '61_90' THEN 4
            ELSE 5
        END;
$$;

CREATE OR REPLACE FUNCTION public.get_accounts_payable_aging(p_tenant_id UUID)
RETURNS TABLE (
    aging_bucket TEXT,
    bill_count BIGINT,
    total_amount NUMERIC
)
LANGUAGE sql
AS $$
    WITH normalized AS (
        SELECT
            CASE
                WHEN due_date IS NULL OR due_date >= CURRENT_DATE THEN 'current'
                WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN '1_30'
                WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN '31_60'
                WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN '61_90'
                ELSE '90_plus'
            END AS bucket,
            COALESCE(balance_due, total, 0)::numeric AS amount
        FROM public.vendor_bills
        WHERE tenant_id = p_tenant_id
          AND COALESCE(status, '') IN ('open', 'partial', 'overdue')
    )
    SELECT
        bucket AS aging_bucket,
        COUNT(*) AS bill_count,
        COALESCE(SUM(amount), 0) AS total_amount
    FROM normalized
    GROUP BY bucket
    ORDER BY
        CASE bucket
            WHEN 'current' THEN 1
            WHEN '1_30' THEN 2
            WHEN '31_60' THEN 3
            WHEN '61_90' THEN 4
            ELSE 5
        END;
$$;

CREATE OR REPLACE FUNCTION public.get_finance_operating_snapshot(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE sql
AS $$
    SELECT jsonb_build_object(
        'openBills', COALESCE((
            SELECT COUNT(*)
            FROM public.vendor_bills
            WHERE tenant_id = p_tenant_id
              AND COALESCE(status, '') IN ('open', 'partial', 'overdue')
        ), 0),
        'overdueBills', COALESCE((
            SELECT COUNT(*)
            FROM public.vendor_bills
            WHERE tenant_id = p_tenant_id
              AND due_date < CURRENT_DATE
              AND COALESCE(status, '') IN ('open', 'partial', 'overdue')
        ), 0),
        'activeBankAccounts', COALESCE((
            SELECT COUNT(*)
            FROM public.bank_accounts
            WHERE tenant_id = p_tenant_id
              AND is_active = true
        ), 0),
        'unreconciledTransactions', COALESCE((
            SELECT COUNT(*)
            FROM public.bank_transactions
            WHERE tenant_id = p_tenant_id
              AND COALESCE(reconciled, false) = false
        ), 0),
        'pendingContractApprovals', COALESCE((
            SELECT COUNT(*)
            FROM public.contract_approvals
            WHERE tenant_id = p_tenant_id
              AND status = 'pending'
        ), 0),
        'activeContractTemplates', COALESCE((
            SELECT COUNT(*)
            FROM public.contract_templates
            WHERE (tenant_id = p_tenant_id OR tenant_id IS NULL)
              AND is_active = true
        ), 0)
    );
$$;

COMMIT;
