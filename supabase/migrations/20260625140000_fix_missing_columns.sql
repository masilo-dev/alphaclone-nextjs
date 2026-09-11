-- Add deal_id and contract_id to projects so the revenue-leakage panel can
-- traverse the deal → project → contract → invoice chain without 400 errors.
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deal_id ON public.projects (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_contract_id ON public.projects (contract_id) WHERE contract_id IS NOT NULL;

-- Add total_amount as a stored generated column on business_invoices so that
-- all existing code that references total_amount keeps working without needing
-- a data migration. The value is always identical to `total`.
ALTER TABLE public.business_invoices
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC GENERATED ALWAYS AS (total) STORED;

-- Also add the missing `currency` and `client_name` columns referenced by
-- several services, so those queries stop returning 400 errors too.
ALTER TABLE public.business_invoices
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS client_name TEXT,
    ADD COLUMN IF NOT EXISTS client_email TEXT,
    ADD COLUMN IF NOT EXISTS issued_date DATE GENERATED ALWAYS AS (issue_date) STORED,
    ADD COLUMN IF NOT EXISTS metadata JSONB;
