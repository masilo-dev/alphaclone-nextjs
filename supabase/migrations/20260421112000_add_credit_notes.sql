CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  credit_note_number TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'applied', 'cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_tenant_number
  ON public.credit_notes (tenant_id, credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id
  ON public.credit_notes (invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_created_at
  ON public.credit_notes (tenant_id, created_at DESC);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view credit notes in their tenants" ON public.credit_notes;
CREATE POLICY "Users can view credit notes in their tenants"
  ON public.credit_notes
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert credit notes in their tenants" ON public.credit_notes;
CREATE POLICY "Users can insert credit notes in their tenants"
  ON public.credit_notes
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update credit notes in their tenants" ON public.credit_notes;
CREATE POLICY "Users can update credit notes in their tenants"
  ON public.credit_notes
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_credit_notes_updated_at ON public.credit_notes;
CREATE TRIGGER trg_credit_notes_updated_at
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
