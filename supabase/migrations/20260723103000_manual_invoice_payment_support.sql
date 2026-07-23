-- Manual invoice payment support (production drift fix).
-- Safe to re-run. Paste into Supabase SQL Editor and Run.

-- ─── 1) Invoice payment columns ──────────────────────────────────────────────
ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING';

UPDATE public.business_invoices
SET amount_paid = COALESCE(total, 0)
WHERE status = 'paid'
  AND COALESCE(amount_paid, 0) = 0
  AND COALESCE(total, 0) > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_invoices'
      AND column_name = 'balance_due'
  ) THEN
    ALTER TABLE public.business_invoices
      ADD COLUMN balance_due NUMERIC(15,2)
      GENERATED ALWAYS AS (COALESCE(total, 0) - COALESCE(amount_paid, 0)) STORED;
  END IF;
END $$;

-- Allow partially_paid (and other payment lifecycle statuses)
ALTER TABLE public.business_invoices DROP CONSTRAINT IF EXISTS business_invoices_status_check;
ALTER TABLE public.business_invoices
  ADD CONSTRAINT business_invoices_status_check
  CHECK (status IN (
    'draft','sent','viewed','partially_paid','paid','overdue','disputed','void','cancelled'
  ));

-- ─── 2) Payment ledger table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  source text NOT NULL DEFAULT 'manual',
  external_reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_business_invoice_payments_invoice
  ON public.business_invoice_payments (tenant_id, invoice_id, created_at DESC);

ALTER TABLE public.business_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_invoice_payments_tenant_read ON public.business_invoice_payments;
CREATE POLICY business_invoice_payments_tenant_read ON public.business_invoice_payments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS business_invoice_payments_service_all ON public.business_invoice_payments;
CREATE POLICY business_invoice_payments_service_all ON public.business_invoice_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON public.business_invoice_payments TO service_role;

-- ─── 3) Automation + audit tables used after payment ─────────────────────────
CREATE TABLE IF NOT EXISTS public.business_automation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  processed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_unprocessed
  ON public.business_automation_events (tenant_id, created_at ASC)
  WHERE processed = false;

ALTER TABLE public.business_automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_manage_events" ON public.business_automation_events;
CREATE POLICY "service_role_manage_events" ON public.business_automation_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_read_events" ON public.business_automation_events;
CREATE POLICY "tenant_read_events" ON public.business_automation_events
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.business_automation_events TO service_role;

CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  event_type    TEXT NOT NULL,
  event_data    JSONB,
  performed_by  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_invoice_id ON public.invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_tenant_id ON public.invoice_audit_log(tenant_id);

ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_audit_log_service_insert" ON public.invoice_audit_log;
CREATE POLICY "invoice_audit_log_service_insert" ON public.invoice_audit_log
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_audit_log_tenant_select" ON public.invoice_audit_log;
CREATE POLICY "invoice_audit_log_tenant_select" ON public.invoice_audit_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

GRANT INSERT, SELECT ON public.invoice_audit_log TO service_role;

-- ─── 4) Payment RPC (manual approve works even without full COA) ─────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_invoice_payment_source
  ON public.journal_entries (tenant_id, source_type, source_id)
  WHERE source_type = 'invoice_payment';

DROP FUNCTION IF EXISTS public.record_business_invoice_payment(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid);

CREATE FUNCTION public.record_business_invoice_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_source text DEFAULT 'manual',
  p_external_reference text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS SETOF public.business_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.business_invoices%ROWTYPE;
  v_existing_payment public.business_invoice_payments%ROWTYPE;
  v_payment public.business_invoice_payments%ROWTYPE;
  v_total numeric;
  v_paid numeric;
  v_tax numeric;
  v_tax_share numeric;
  v_revenue_share numeric;
  v_cash_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_entry_id uuid;
  v_new_status text;
  v_currency text;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Payment idempotency key is required';
  END IF;

  SELECT * INTO v_invoice
  FROM public.business_invoices
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT * INTO v_existing_payment
  FROM public.business_invoice_payments
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing_payment.invoice_id <> p_invoice_id OR v_existing_payment.amount <> p_amount THEN
      RAISE EXCEPTION 'Payment idempotency key was already used for a different payment';
    END IF;
    RETURN QUERY
      SELECT * FROM public.business_invoices
      WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
    RETURN;
  END IF;

  IF v_invoice.status IN ('void', 'cancelled', 'disputed') THEN
    RAISE EXCEPTION 'This invoice cannot accept payments';
  END IF;

  v_total := COALESCE(v_invoice.total, 0);
  v_paid := COALESCE(v_invoice.amount_paid, 0);
  v_currency := COALESCE(NULLIF(v_invoice.currency, ''), 'USD');

  IF v_paid >= v_total THEN
    RAISE EXCEPTION 'Invoice is already paid';
  END IF;
  IF p_amount > v_total - v_paid THEN
    RAISE EXCEPTION 'Payment exceeds the remaining invoice balance';
  END IF;

  INSERT INTO public.business_invoice_payments (
    tenant_id, invoice_id, idempotency_key, amount, currency, source, external_reference, recorded_by
  ) VALUES (
    p_tenant_id, p_invoice_id, p_idempotency_key, p_amount,
    v_currency, COALESCE(NULLIF(p_source, ''), 'manual'),
    p_external_reference, p_actor_user_id
  ) RETURNING * INTO v_payment;

  v_new_status := CASE
    WHEN v_paid + p_amount >= v_total THEN 'paid'
    ELSE 'partially_paid'
  END;

  -- Best-effort accounting journal. Manual payments must succeed even if COA is incomplete.
  BEGIN
    SELECT id INTO v_cash_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id
      AND account_code = '1000'
      AND deleted_at IS NULL
      AND is_active IS DISTINCT FROM false
    LIMIT 1;

    SELECT id INTO v_revenue_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id
      AND account_code IN ('4100', '4000')
      AND deleted_at IS NULL
      AND is_active IS DISTINCT FROM false
    ORDER BY account_code DESC
    LIMIT 1;

    SELECT id INTO v_tax_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id
      AND account_code = '2100'
      AND deleted_at IS NULL
      AND is_active IS DISTINCT FROM false
    LIMIT 1;

    v_tax := GREATEST(COALESCE(v_invoice.tax, 0), 0);
    v_tax_share := CASE
      WHEN v_total > 0 THEN round((p_amount * v_tax / v_total)::numeric, 2)
      ELSE 0
    END;
    v_revenue_share := p_amount - v_tax_share;

    IF v_cash_account_id IS NOT NULL
       AND v_revenue_account_id IS NOT NULL
       AND (v_tax_share = 0 OR v_tax_account_id IS NOT NULL) THEN
      INSERT INTO public.journal_entries (
        tenant_id, entry_number, entry_date, description, reference,
        source_type, source_id, status, total_debits, total_credits,
        currency, posted_at, posted_by, created_by
      ) VALUES (
        p_tenant_id,
        'PAY-' || left(replace(v_payment.id::text, '-', ''), 12),
        CURRENT_DATE,
        'Payment received for Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
        COALESCE(p_external_reference, v_invoice.invoice_number),
        'invoice_payment',
        v_payment.id,
        'posted',
        p_amount,
        p_amount,
        v_currency,
        now(),
        p_actor_user_id,
        p_actor_user_id
      ) RETURNING id INTO v_entry_id;

      INSERT INTO public.journal_entry_lines (
        tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
        description, entity_type, entity_id, currency
      ) VALUES
        (p_tenant_id, v_entry_id, 1, v_cash_account_id, p_amount, 0,
         'Cash received - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
         'invoice', p_invoice_id, v_currency),
        (p_tenant_id, v_entry_id, 2, v_revenue_account_id, 0, v_revenue_share,
         'Revenue recognized - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
         'invoice', p_invoice_id, v_currency);

      IF v_tax_share > 0 THEN
        INSERT INTO public.journal_entry_lines (
          tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
          description, entity_type, entity_id, currency
        ) VALUES (
          p_tenant_id, v_entry_id, 3, v_tax_account_id, 0, v_tax_share,
          'Sales tax collected - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
          'invoice', p_invoice_id, v_currency
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Skipped invoice payment journal for %: %', p_invoice_id, SQLERRM;
  END;

  UPDATE public.business_invoices SET
    amount_paid = v_paid + p_amount,
    status = v_new_status,
    paid_at = CASE
      WHEN v_new_status = 'paid' THEN COALESCE(paid_at, now())
      ELSE paid_at
    END,
    delivery_status = CASE
      WHEN v_new_status = 'paid' THEN 'DELIVERED'
      ELSE delivery_status
    END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id;

  BEGIN
    INSERT INTO public.business_automation_events (tenant_id, event_type, payload)
    VALUES (
      p_tenant_id,
      'invoice_payment_recorded',
      jsonb_build_object(
        'paymentId', v_payment.id,
        'invoiceId', p_invoice_id,
        'amount', p_amount,
        'amountPaid', v_paid + p_amount,
        'status', v_new_status,
        'source', COALESCE(NULLIF(p_source, ''), 'manual'),
        'externalReference', p_external_reference,
        'actorUserId', p_actor_user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Skipped automation event for invoice payment %: %', p_invoice_id, SQLERRM;
  END;

  RETURN QUERY
    SELECT * FROM public.business_invoices
    WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  TO service_role;

-- ─── 5) Quick verification ───────────────────────────────────────────────────
-- SELECT to_regprocedure('public.record_business_invoice_payment(uuid,uuid,numeric,text,text,text,uuid)');
-- SELECT to_regclass('public.business_invoice_payments');
