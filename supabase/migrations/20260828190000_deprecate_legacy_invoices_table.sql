-- One-time backfill marker: legacy invoices table is deprecated; canonical source is business_invoices.
-- Safe to run multiple times (no-op when legacy table empty or absent).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    COMMENT ON TABLE public.invoices IS 'DEPRECATED: use business_invoices. Remaining rows should be migrated via DataMigrationService.';
  END IF;
END $$;
