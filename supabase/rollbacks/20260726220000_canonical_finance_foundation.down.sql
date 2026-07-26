-- Rollback only the unused canonical projection. The legacy source tables and
-- historical invoice/payment records are deliberately never deleted.
BEGIN;

DROP TRIGGER IF EXISTS validate_payment_allocation_trigger ON public.payment_allocations;
DROP FUNCTION IF EXISTS public.validate_payment_allocation();
DROP VIEW IF EXISTS public.canonical_invoice_balances;

DROP TABLE IF EXISTS public.recurring_invoice_occurrences;
DROP TABLE IF EXISTS public.recurring_invoice_profiles;
DROP TABLE IF EXISTS public.invoice_public_shares;
DROP TABLE IF EXISTS public.invoice_adjustments;
DROP TABLE IF EXISTS public.payment_allocations;
DROP TABLE IF EXISTS public.finance_payments;
DROP TABLE IF EXISTS public.invoice_status_events;
DROP TABLE IF EXISTS public.invoice_versions;
DROP TABLE IF EXISTS public.finance_feature_flags;
DROP TABLE IF EXISTS public.finance_migration_batches;

-- Additive columns are retained because they can contain migration evidence.
-- Removing them would make rollback destructive and is intentionally omitted.

NOTIFY pgrst, 'reload schema';
COMMIT;
