-- Native finance: recurring profiles, expense invoicing, client finance portal

ALTER TABLE public.recurring_invoices
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.business_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS auto_send BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 14;

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS recurring_config_id UUID REFERENCES public.recurring_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_invoices_recurring_config
  ON public.business_invoices(recurring_config_id)
  WHERE recurring_config_id IS NOT NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.business_clients(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.business_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_expenses_unbilled
  ON public.expenses(tenant_id, client_id)
  WHERE billable = true AND invoice_id IS NULL;

ALTER TABLE public.business_clients
  ADD COLUMN IF NOT EXISTS finance_portal_token UUID DEFAULT gen_random_uuid();

UPDATE public.business_clients
SET finance_portal_token = gen_random_uuid()
WHERE finance_portal_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_clients_finance_portal_token
  ON public.business_clients(finance_portal_token)
  WHERE finance_portal_token IS NOT NULL;
