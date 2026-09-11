-- Production drift: business_invoices.amount_paid is required by payment RPCs,
-- invoice services, MCP finance tools, and dashboard outstanding-balance math.
-- Safe to re-run: IF NOT EXISTS / DO blocks guard generated columns.

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Keep paid invoices consistent when the column is newly introduced.
UPDATE public.business_invoices
SET amount_paid = COALESCE(total, 0)
WHERE status = 'paid'
  AND COALESCE(amount_paid, 0) = 0
  AND COALESCE(total, 0) > 0;

-- Generated remaining balance (same pattern as vendor_bills).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_invoices'
      AND column_name = 'balance_due'
  ) THEN
    ALTER TABLE public.business_invoices
      ADD COLUMN balance_due NUMERIC(15,2)
      GENERATED ALWAYS AS (COALESCE(total, 0) - COALESCE(amount_paid, 0)) STORED;
  END IF;
END $$;

-- Payment RPC / status transitions also rely on these compatibility columns.
ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS idx_business_invoices_amount_paid
  ON public.business_invoices (tenant_id, amount_paid)
  WHERE amount_paid > 0;
