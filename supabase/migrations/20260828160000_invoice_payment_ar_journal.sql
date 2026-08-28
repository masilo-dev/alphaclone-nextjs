-- Payment journal: credit Accounts Receivable (not Revenue) when cash is received.
-- Revenue should be recognized at invoice issue; payment clears AR.

CREATE OR REPLACE FUNCTION public.record_business_invoice_payment(
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
  v_cash_account_id uuid;
  v_ar_account_id uuid;
  v_entry_id uuid;
  v_new_status text;
  v_currency text;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'Payment idempotency key is required'; END IF;

  SELECT * INTO v_invoice
  FROM public.business_invoices
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  SELECT * INTO v_existing_payment
  FROM public.business_invoice_payments
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing_payment.invoice_id <> p_invoice_id OR v_existing_payment.amount <> p_amount THEN
      RAISE EXCEPTION 'Payment idempotency key was already used for a different payment';
    END IF;
    RETURN QUERY SELECT * FROM public.business_invoices WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
    RETURN;
  END IF;

  IF v_invoice.status IN ('void', 'cancelled', 'disputed') THEN
    RAISE EXCEPTION 'This invoice cannot accept payments';
  END IF;

  v_total := COALESCE(v_invoice.total, 0);
  v_paid := COALESCE(v_invoice.amount_paid, 0);
  v_currency := COALESCE(NULLIF(v_invoice.currency, ''), 'USD');

  IF v_paid >= v_total THEN RAISE EXCEPTION 'Invoice is already paid'; END IF;
  IF p_amount > v_total - v_paid THEN RAISE EXCEPTION 'Payment exceeds the remaining invoice balance'; END IF;

  INSERT INTO public.business_invoice_payments (
    tenant_id, invoice_id, idempotency_key, amount, currency, source, external_reference, recorded_by
  ) VALUES (
    p_tenant_id, p_invoice_id, p_idempotency_key, p_amount,
    v_currency, COALESCE(NULLIF(p_source, ''), 'manual'),
    p_external_reference, p_actor_user_id
  ) RETURNING * INTO v_payment;

  v_new_status := CASE WHEN v_paid + p_amount >= v_total THEN 'paid' ELSE 'partially_paid' END;

  BEGIN
    SELECT id INTO v_cash_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '1000'
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
    LIMIT 1;
    SELECT id INTO v_ar_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code IN ('1100', '1200')
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
    ORDER BY account_code ASC LIMIT 1;

    IF v_cash_account_id IS NOT NULL AND v_ar_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        tenant_id, entry_number, entry_date, description, reference,
        source_type, source_id, status, total_debits, total_credits,
        currency, posted_at, posted_by, created_by
      ) VALUES (
        p_tenant_id, 'PAY-' || left(replace(v_payment.id::text, '-', ''), 12), CURRENT_DATE,
        'Payment received for Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
        COALESCE(p_external_reference, v_invoice.invoice_number),
        'invoice_payment', v_payment.id, 'posted', p_amount, p_amount,
        v_currency, now(), p_actor_user_id, p_actor_user_id
      ) RETURNING id INTO v_entry_id;

      INSERT INTO public.journal_entry_lines (
        tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
        description, entity_type, entity_id, currency
      ) VALUES
        (p_tenant_id, v_entry_id, 1, v_cash_account_id, p_amount, 0,
         'Cash received - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
         'invoice', p_invoice_id, v_currency),
        (p_tenant_id, v_entry_id, 2, v_ar_account_id, 0, p_amount,
         'Accounts receivable cleared - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
         'invoice', p_invoice_id, v_currency);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Skipped invoice payment journal for %: %', p_invoice_id, SQLERRM;
  END;

  UPDATE public.business_invoices SET
    amount_paid = v_paid + p_amount,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
    delivery_status = CASE WHEN v_new_status = 'paid' THEN 'DELIVERED' ELSE delivery_status END,
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

  RETURN QUERY SELECT * FROM public.business_invoices WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  TO service_role;
