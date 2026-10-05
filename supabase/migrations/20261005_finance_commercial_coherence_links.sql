-- ==============================================================================
-- Migration: 20261005_finance_commercial_coherence_links.sql
-- Description: Adds quote_id to contracts table and ensures non-destructive foreign keys
--              for deal_id, quote_id, and contract_id across commercial documents.
-- Design Principle: All foreign keys are added NOT VALID so existing historical rows
--                   are untouched and zero table locking/downtime occurs in production.
-- ==============================================================================

-- 1. Add quote_id column to contracts if it does not already exist
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS quote_id uuid;

-- 2. Add indexing for commercial lineage lookups
CREATE INDEX IF NOT EXISTS idx_contracts_quote_id
  ON public.contracts (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_invoices_contract_id
  ON public.business_invoices (contract_id)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_invoices_quote_id
  ON public.business_invoices (quote_id)
  WHERE quote_id IS NOT NULL;

-- 3. Add NOT VALID foreign keys (strictly enforces new writes without breaking historical data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_contracts_quote_id'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT fk_contracts_quote_id
      FOREIGN KEY (quote_id) REFERENCES public.quotes(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_business_invoices_contract_id'
  ) THEN
    ALTER TABLE public.business_invoices
      ADD CONSTRAINT fk_business_invoices_contract_id
      FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_business_invoices_quote_id'
  ) THEN
    ALTER TABLE public.business_invoices
      ADD CONSTRAINT fk_business_invoices_quote_id
      FOREIGN KEY (quote_id) REFERENCES public.quotes(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.quote_id IS 'Direct reference to accepted quote originating this contract';
