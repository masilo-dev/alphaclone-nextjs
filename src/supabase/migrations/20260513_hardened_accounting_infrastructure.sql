-- Hardened Accounting and E-Signature Infrastructure
-- Date: 2026-05-13

BEGIN;

-- 1. Hardening business_invoices schema
ALTER TABLE public.business_invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.business_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Hardening contracts schema
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signing_token TEXT UNIQUE;

-- 3. Data Integrity: Sync legacy template_type to new type column
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'template_type') THEN
        UPDATE public.contracts SET type = template_type WHERE type IS NULL;
    END IF;
END $$;

-- 4. Reload PostgREST schema cache to resolve desyncs
NOTIFY pgrst, 'reload schema';

COMMIT;
