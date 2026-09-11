ALTER TABLE public.cash_flow_projections
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated', 'confirmed'));

ALTER TABLE public.tax_records
  ADD COLUMN IF NOT EXISTS deduction_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paid'));
