-- Keep the legacy payment write path and canonical financial evidence in one
-- transaction while tenants are still using dual-read/dual-write mode.
-- This migration is additive and re-runnable: it preserves every legacy row.
BEGIN;

-- A confirmed payment is financial evidence, not delivery evidence. Older
-- payment RPCs set delivery_status to DELIVERED as a side effect; preserve the
-- actual delivery state until a delivery receipt changes it.
CREATE OR REPLACE FUNCTION public.prevent_payment_from_forging_delivery_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid', 'partially_paid')
     AND NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
     AND upper(COALESCE(NEW.delivery_status, '')) = 'DELIVERED' THEN
    NEW.delivery_status := OLD.delivery_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_payment_from_forging_delivery_state_trigger ON public.business_invoices;
CREATE TRIGGER prevent_payment_from_forging_delivery_state_trigger
BEFORE UPDATE OF status, delivery_status ON public.business_invoices
FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_from_forging_delivery_state();

CREATE OR REPLACE FUNCTION public.project_legacy_invoice_payment_to_canonical()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_currency char(3);
BEGIN
  SELECT upper(left(COALESCE(NULLIF(currency, ''), 'USD'), 3))::char(3)
  INTO v_currency
  FROM public.business_invoices
  WHERE id = NEW.invoice_id AND tenant_id = NEW.tenant_id;

  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'Cannot project a payment for an invoice outside its tenant';
  END IF;

  INSERT INTO public.finance_payments (
    tenant_id, payment_number, amount, currency_code, status, payment_method,
    reference, payment_date, source, idempotency_key, verification_state,
    legacy_source_id, created_by, created_at, metadata
  ) VALUES (
    NEW.tenant_id, 'LEG-' || upper(left(replace(NEW.id::text, '-', ''), 12)),
    NEW.amount, v_currency, 'succeeded', NEW.source, NEW.external_reference,
    NEW.created_at, NEW.source, 'legacy:' || NEW.id::text, 'legacy_evidence',
    NEW.id, NEW.recorded_by, NEW.created_at,
    jsonb_build_object('legacy_table', 'business_invoice_payments')
  ) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

  SELECT id INTO v_payment_id
  FROM public.finance_payments
  WHERE tenant_id = NEW.tenant_id AND idempotency_key = 'legacy:' || NEW.id::text;

  IF NOT EXISTS (
    SELECT 1 FROM public.payment_allocations a
    WHERE a.tenant_id = NEW.tenant_id
      AND a.payment_id = v_payment_id
      AND a.invoice_id = NEW.invoice_id
      AND a.reversed_at IS NULL
  ) THEN
    INSERT INTO public.payment_allocations (
      tenant_id, payment_id, invoice_id, allocated_amount, allocated_at,
      created_by, metadata
    ) VALUES (
      NEW.tenant_id, v_payment_id, NEW.invoice_id, NEW.amount, NEW.created_at,
      NEW.recorded_by, jsonb_build_object('legacyPaymentId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Project payment rows created after the original canonical backfill. This is
-- intentionally evidence-preserving and never modifies existing source rows.
INSERT INTO public.finance_payments (
  tenant_id, payment_number, amount, currency_code, status, payment_method,
  reference, payment_date, source, idempotency_key, verification_state,
  legacy_source_id, created_by, created_at, metadata
)
SELECT
  p.tenant_id, 'LEG-' || upper(left(replace(p.id::text, '-', ''), 12)), p.amount,
  upper(left(COALESCE(NULLIF(p.currency, ''), 'USD'), 3))::char(3), 'succeeded',
  p.source, p.external_reference, p.created_at, p.source, 'legacy:' || p.id::text,
  'legacy_evidence', p.id, p.recorded_by, p.created_at,
  jsonb_build_object('legacy_table', 'business_invoice_payments')
FROM public.business_invoice_payments p
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

INSERT INTO public.payment_allocations (
  tenant_id, payment_id, invoice_id, allocated_amount, allocated_at, created_by, metadata
)
SELECT
  p.tenant_id, fp.id, p.invoice_id, p.amount, p.created_at, p.recorded_by,
  jsonb_build_object('legacyPaymentId', p.id)
FROM public.business_invoice_payments p
JOIN public.finance_payments fp
  ON fp.tenant_id = p.tenant_id AND fp.idempotency_key = 'legacy:' || p.id::text
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_allocations a
  WHERE a.tenant_id = p.tenant_id AND a.payment_id = fp.id
    AND a.invoice_id = p.invoice_id AND a.reversed_at IS NULL
);

DROP TRIGGER IF EXISTS project_legacy_invoice_payment_to_canonical_trigger ON public.business_invoice_payments;
CREATE TRIGGER project_legacy_invoice_payment_to_canonical_trigger
AFTER INSERT ON public.business_invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.project_legacy_invoice_payment_to_canonical();

CREATE OR REPLACE VIEW public.canonical_invoice_financial_status
WITH (security_invoker = true)
AS
SELECT
  i.tenant_id, i.id AS invoice_id, i.invoice_number, i.lifecycle_status,
  i.canonical_delivery_status AS delivery_status, b.currency_code,
  b.total_amount, b.allocated_amount, b.balance_due, b.payment_status,
  CASE
    WHEN b.payment_status = 'disputed' THEN 'disputed'
    WHEN b.balance_due <= 0 THEN 'normal'
    WHEN EXISTS (
      SELECT 1 FROM public.chase_instances ci
      WHERE ci.tenant_id = i.tenant_id AND ci.entity_id = i.id
        AND ci.entity_type = 'invoice'
        AND ci.state NOT IN ('RESOLVED', 'EXHAUSTED', 'CANCELLED')
    ) THEN 'collection_active'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    WHEN i.due_date <= CURRENT_DATE + 7 THEN 'due_soon'
    ELSE 'normal'
  END AS collection_status,
  CASE
    WHEN b.balance_due <= 0 THEN 'Paid'
    WHEN i.due_date < CURRENT_DATE THEN 'Overdue'
    WHEN b.payment_status = 'partially_paid' THEN 'Partially paid'
    WHEN i.lifecycle_status = 'draft' THEN 'Draft'
    WHEN i.canonical_delivery_status = 'failed' THEN 'Delivery failed'
    WHEN i.canonical_delivery_status = 'not_sent' THEN 'Not sent'
    ELSE 'Unpaid'
  END AS display_status
FROM public.business_invoices i
JOIN public.canonical_invoice_balances b
  ON b.tenant_id = i.tenant_id AND b.invoice_id = i.id;

REVOKE ALL ON FUNCTION public.project_legacy_invoice_payment_to_canonical() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_payment_from_forging_delivery_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.canonical_invoice_financial_status FROM anon;
GRANT SELECT ON public.canonical_invoice_financial_status TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
