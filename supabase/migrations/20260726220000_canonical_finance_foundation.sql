-- Canonical finance foundation. Additive and rollback-safe.
-- Existing business_invoices and business_invoice_payments remain untouched as
-- the legacy write model until reconciliation and dual-read checks pass.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.finance_migration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  migration_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','review_required','verified','failed','rolled_back')),
  source_count integer NOT NULL DEFAULT 0,
  migrated_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  source_checksum text,
  destination_checksum text,
  discrepancy_report jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_feature_flags (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  canonical_dual_read boolean NOT NULL DEFAULT false,
  canonical_write boolean NOT NULL DEFAULT false,
  canonical_read boolean NOT NULL DEFAULT false,
  accounting_mode boolean NOT NULL DEFAULT false,
  verified_batch_id uuid REFERENCES public.finance_migration_batches(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT canonical_write OR canonical_dual_read),
  CHECK (NOT canonical_read OR (canonical_write AND verified_batch_id IS NOT NULL))
);

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS canonical_delivery_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS currency_code char(3),
  ADD COLUMN IF NOT EXISTS customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_address_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_id uuid,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS recurring_profile_id uuid,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS migration_verification_state text NOT NULL DEFAULT 'not_migrated',
  ADD COLUMN IF NOT EXISTS legacy_financial_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.business_invoices
  DROP CONSTRAINT IF EXISTS business_invoices_lifecycle_status_check,
  ADD CONSTRAINT business_invoices_lifecycle_status_check CHECK (
    lifecycle_status IN ('draft','pending_approval','approved','scheduled','issued','voided','written_off','archived')
  ),
  DROP CONSTRAINT IF EXISTS business_invoices_canonical_delivery_status_check,
  ADD CONSTRAINT business_invoices_canonical_delivery_status_check CHECK (
    canonical_delivery_status IN ('not_sent','queued','sending','sent','delivered','viewed','failed','bounced')
  ),
  DROP CONSTRAINT IF EXISTS business_invoices_migration_verification_check,
  ADD CONSTRAINT business_invoices_migration_verification_check CHECK (
    migration_verification_state IN ('not_migrated','verified','legacy_evidence','review_required')
  );

UPDATE public.business_invoices
SET currency_code = upper(left(COALESCE(NULLIF(currency, ''), 'USD'), 3))
WHERE currency_code IS NULL;
ALTER TABLE public.business_invoices ALTER COLUMN currency_code SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.invoice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number > 0),
  document_snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  dimension text NOT NULL CHECK (dimension IN ('lifecycle','delivery','payment','due')),
  previous_value text,
  new_value text NOT NULL,
  evidence_type text,
  evidence_id uuid,
  actor_user_id uuid,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS service_id uuid,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(20,4),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_amount numeric(20,4),
  ADD COLUMN IF NOT EXISTS cost_basis_amount numeric(20,4),
  ADD COLUMN IF NOT EXISTS revenue_account_id uuid,
  ADD COLUMN IF NOT EXISTS tax_rate_id uuid,
  ADD COLUMN IF NOT EXISTS legacy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.finance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  payment_number text NOT NULL,
  customer_id uuid,
  amount numeric(20,4) NOT NULL CHECK (amount > 0),
  currency_code char(3) NOT NULL,
  status text NOT NULL CHECK (status IN (
    'pending','authorised','processing','succeeded','failed','cancelled',
    'reversed','partially_refunded','refunded','disputed'
  )),
  payment_method text,
  provider text,
  provider_transaction_id text,
  reference text,
  payment_date timestamptz,
  settlement_date timestamptz,
  processing_fee_amount numeric(20,4) NOT NULL DEFAULT 0,
  net_settlement_amount numeric(20,4),
  bank_account_id uuid,
  journal_entry_id uuid,
  source text NOT NULL DEFAULT 'manual',
  idempotency_key text NOT NULL,
  verification_state text NOT NULL DEFAULT 'verified'
    CHECK (verification_state IN ('verified','legacy_evidence','review_required')),
  legacy_source_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payment_number),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_payments_provider_event_uidx
  ON public.finance_payments (tenant_id, provider, provider_transaction_id)
  WHERE provider IS NOT NULL AND provider_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES public.finance_payments(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  allocated_amount numeric(20,4) NOT NULL CHECK (allocated_amount > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_reason text,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('credit','refund','write_off')),
  amount numeric(20,4) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','reversed')),
  source_id uuid,
  reason text NOT NULL,
  posted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_public_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  requires_email_verification boolean NOT NULL DEFAULT false,
  passcode_hash text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_invoice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  customer_id uuid,
  template_invoice_id uuid REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','custom')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  start_date date NOT NULL,
  end_date date,
  next_run_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  currency_code char(3) NOT NULL,
  auto_send boolean NOT NULL DEFAULT false,
  auto_charge boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT true,
  maximum_occurrences integer,
  occurrence_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed','cancelled','failed')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.recurring_invoice_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  recurring_profile_id uuid NOT NULL REFERENCES public.recurring_invoice_profiles(id) ON DELETE RESTRICT,
  scheduled_for timestamptz NOT NULL,
  invoice_id uuid REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','created','failed','cancelled')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (recurring_profile_id, scheduled_for)
);

-- Preserve legacy values before any compatibility mapping.
UPDATE public.business_invoices
SET legacy_financial_snapshot = jsonb_strip_nulls(jsonb_build_object(
      'status', status,
      'delivery_status', delivery_status,
      'issue_date', issue_date,
      'total', total,
      'amount_paid', amount_paid,
      'paid_at', paid_at,
      'line_items', line_items
    )),
    lifecycle_status = CASE
      WHEN status = 'draft' THEN 'draft'
      WHEN status IN ('void','cancelled') THEN 'voided'
      ELSE 'issued'
    END,
    canonical_delivery_status = CASE lower(COALESCE(delivery_status, ''))
      WHEN 'sent' THEN 'sent' WHEN 'delivered' THEN 'delivered'
      WHEN 'viewed' THEN 'viewed' WHEN 'failed' THEN 'failed'
      WHEN 'bounced' THEN 'bounced' ELSE 'not_sent'
    END,
    migration_verification_state = CASE
      WHEN status IN ('paid','partially_paid') AND COALESCE(amount_paid, 0) <= 0 THEN 'review_required'
      WHEN status = 'paid' AND paid_at IS NULL THEN 'legacy_evidence'
      ELSE 'not_migrated'
    END
WHERE legacy_financial_snapshot = '{}'::jsonb;

-- Canonicalize legacy payment evidence without changing or deleting the source.
INSERT INTO public.finance_payments (
  id, tenant_id, payment_number, amount, currency_code, status, payment_method,
  reference, payment_date, source, idempotency_key, verification_state,
  legacy_source_id, created_by, created_at, metadata
)
SELECT
  gen_random_uuid(), p.tenant_id, 'LEG-' || upper(left(replace(p.id::text, '-', ''), 12)),
  p.amount, upper(left(COALESCE(NULLIF(p.currency, ''), 'USD'), 3)), 'succeeded',
  p.source, p.external_reference, p.created_at, p.source,
  'legacy:' || p.id::text, 'legacy_evidence', p.id, p.recorded_by, p.created_at,
  jsonb_build_object('legacy_table', 'business_invoice_payments')
FROM public.business_invoice_payments p
ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

INSERT INTO public.payment_allocations (
  tenant_id, payment_id, invoice_id, allocated_amount, allocated_at, created_by,
  metadata
)
SELECT p.tenant_id, fp.id, p.invoice_id, p.amount, p.created_at, p.recorded_by,
       jsonb_build_object('legacyPaymentId', p.id)
FROM public.business_invoice_payments p
JOIN public.finance_payments fp
  ON fp.tenant_id = p.tenant_id AND fp.legacy_source_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_allocations pa
  WHERE pa.tenant_id = p.tenant_id
    AND pa.payment_id = fp.id
    AND pa.invoice_id = p.invoice_id
);

CREATE OR REPLACE VIEW public.canonical_invoice_balances
WITH (security_invoker = true)
AS
SELECT
  i.tenant_id,
  i.id AS invoice_id,
  i.currency_code,
  COALESCE(i.total, 0)::numeric(20,4) AS total_amount,
  COALESCE(a.allocated_amount, 0)::numeric(20,4) AS allocated_amount,
  COALESCE(x.credit_amount, 0)::numeric(20,4) AS credit_amount,
  COALESCE(x.refund_amount, 0)::numeric(20,4) AS refund_amount,
  COALESCE(x.write_off_amount, 0)::numeric(20,4) AS write_off_amount,
  GREATEST(
    COALESCE(i.total, 0) - COALESCE(a.allocated_amount, 0)
      - COALESCE(x.credit_amount, 0) - COALESCE(x.write_off_amount, 0)
      + COALESCE(x.refund_amount, 0),
    0
  )::numeric(20,4) AS balance_due,
  CASE
    WHEN COALESCE(a.allocated_amount, 0) + COALESCE(x.credit_amount, 0)
         + COALESCE(x.write_off_amount, 0) - COALESCE(x.refund_amount, 0) <= 0 THEN 'unpaid'
    WHEN COALESCE(a.allocated_amount, 0) + COALESCE(x.credit_amount, 0)
         + COALESCE(x.write_off_amount, 0) - COALESCE(x.refund_amount, 0) < COALESCE(i.total, 0) THEN 'partially_paid'
    WHEN COALESCE(a.allocated_amount, 0) + COALESCE(x.credit_amount, 0)
         + COALESCE(x.write_off_amount, 0) - COALESCE(x.refund_amount, 0) = COALESCE(i.total, 0) THEN 'paid'
    ELSE 'overpaid'
  END AS payment_status
FROM public.business_invoices i
LEFT JOIN (
  SELECT tenant_id, invoice_id, sum(allocated_amount) AS allocated_amount
  FROM public.payment_allocations WHERE reversed_at IS NULL GROUP BY tenant_id, invoice_id
) a ON a.tenant_id = i.tenant_id AND a.invoice_id = i.id
LEFT JOIN (
  SELECT tenant_id, invoice_id,
    sum(amount) FILTER (WHERE adjustment_type = 'credit' AND status = 'posted') AS credit_amount,
    sum(amount) FILTER (WHERE adjustment_type = 'refund' AND status = 'posted') AS refund_amount,
    sum(amount) FILTER (WHERE adjustment_type = 'write_off' AND status = 'posted') AS write_off_amount
  FROM public.invoice_adjustments GROUP BY tenant_id, invoice_id
) x ON x.tenant_id = i.tenant_id AND x.invoice_id = i.id;

CREATE OR REPLACE FUNCTION public.validate_payment_allocation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  payment_amount numeric(20,4);
  allocated_total numeric(20,4);
  invoice_total numeric(20,4);
  invoice_settled numeric(20,4);
  available numeric(20,4);
  invoice_balance numeric(20,4);
BEGIN
  -- Allocations are financial evidence. Correct them by reversing the old row
  -- and inserting a replacement, never by changing its amount or ownership.
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Payment allocations are immutable; reverse and replace the allocation';
  END IF;

  -- The row locks serialize allocations touching either side of the match.
  -- Lock payment first and invoice second everywhere to avoid deadlocks.
  SELECT p.amount INTO payment_amount
  FROM public.finance_payments p
  WHERE p.id = NEW.payment_id
    AND p.tenant_id = NEW.tenant_id
    AND p.status = 'succeeded'
  FOR UPDATE;
  IF payment_amount IS NULL THEN RAISE EXCEPTION 'Successful tenant payment not found'; END IF;

  SELECT i.total INTO invoice_total
  FROM public.business_invoices i
  WHERE i.id = NEW.invoice_id AND i.tenant_id = NEW.tenant_id
  FOR UPDATE;
  IF invoice_total IS NULL THEN RAISE EXCEPTION 'Tenant invoice not found'; END IF;

  SELECT COALESCE(sum(a.allocated_amount), 0) INTO allocated_total
  FROM public.payment_allocations a
  WHERE a.tenant_id = NEW.tenant_id
    AND a.payment_id = NEW.payment_id
    AND a.reversed_at IS NULL;
  available := payment_amount - allocated_total;
  IF NEW.allocated_amount > available THEN RAISE EXCEPTION 'Allocation exceeds available payment amount'; END IF;

  SELECT
    COALESCE((
      SELECT sum(a.allocated_amount)
      FROM public.payment_allocations a
      WHERE a.tenant_id = NEW.tenant_id
        AND a.invoice_id = NEW.invoice_id
        AND a.reversed_at IS NULL
    ), 0)
    + COALESCE((
      SELECT COALESCE(sum(x.amount) FILTER (
        WHERE x.adjustment_type IN ('credit', 'write_off') AND x.status = 'posted'
      ), 0) - COALESCE(sum(x.amount) FILTER (
        WHERE x.adjustment_type = 'refund' AND x.status = 'posted'
      ), 0)
      FROM public.invoice_adjustments x
      WHERE x.tenant_id = NEW.tenant_id AND x.invoice_id = NEW.invoice_id
    ), 0)
  INTO invoice_settled;
  invoice_balance := GREATEST(invoice_total - invoice_settled, 0);
  IF NEW.allocated_amount > invoice_balance THEN RAISE EXCEPTION 'Allocation exceeds invoice balance'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_payment_allocation_trigger ON public.payment_allocations;
CREATE TRIGGER validate_payment_allocation_trigger
BEFORE INSERT OR UPDATE OF allocated_amount, payment_id, invoice_id
ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.validate_payment_allocation();

CREATE INDEX IF NOT EXISTS invoice_status_events_tenant_invoice_idx
  ON public.invoice_status_events (tenant_id, invoice_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS payment_allocations_tenant_invoice_idx
  ON public.payment_allocations (tenant_id, invoice_id) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS payment_allocations_tenant_payment_idx
  ON public.payment_allocations (tenant_id, payment_id) WHERE reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS finance_payments_tenant_customer_date_idx
  ON public.finance_payments (tenant_id, customer_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS invoice_adjustments_tenant_invoice_idx
  ON public.invoice_adjustments (tenant_id, invoice_id, created_at DESC);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'finance_migration_batches','finance_feature_flags','invoice_versions',
    'invoice_status_events','finance_payments','payment_allocations',
    'invoice_adjustments','invoice_public_shares','recurring_invoice_profiles',
    'recurring_invoice_occurrences'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_membership_access ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_membership_access ON public.%I FOR ALL TO authenticated ' ||
      'USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())) ' ||
      'WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))',
      table_name, table_name, table_name
    );
  END LOOP;
END $$;

REVOKE ALL ON public.canonical_invoice_balances FROM anon;
GRANT SELECT ON public.canonical_invoice_balances TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_payment_allocation() FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
COMMIT;
