-- Revenue recognition at invoice issue: AR debit / Revenue (+ tax liability) credit.

CREATE OR REPLACE FUNCTION public.post_business_invoice_issue_journal(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS TABLE(posted boolean, entry_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.business_invoices%ROWTYPE;
  v_existing integer;
  v_ar_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_entry_id uuid;
  v_amount numeric;
  v_tax numeric;
  v_revenue_share numeric;
  v_currency text;
BEGIN
  SELECT * INTO v_invoice
  FROM public.business_invoices
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  IF v_invoice.status IN ('void', 'cancelled', 'draft') THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM public.journal_entries
  WHERE tenant_id = p_tenant_id
    AND source_type = 'invoice_issue'
    AND source_id = p_invoice_id
    AND status = 'posted';
  IF v_existing > 0 THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  v_amount := GREATEST(COALESCE(v_invoice.total, 0), 0);
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  v_tax := GREATEST(COALESCE(v_invoice.tax, 0), 0);
  v_revenue_share := v_amount - v_tax;
  v_currency := COALESCE(NULLIF(v_invoice.currency, ''), 'USD');

  SELECT id INTO v_ar_account_id
  FROM public.chart_of_accounts
  WHERE tenant_id = p_tenant_id AND account_code IN ('1100', '1200')
    AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
  ORDER BY account_code ASC LIMIT 1;

  SELECT id INTO v_revenue_account_id
  FROM public.chart_of_accounts
  WHERE tenant_id = p_tenant_id AND account_code IN ('4100', '4000')
    AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
  ORDER BY account_code DESC LIMIT 1;

  SELECT id INTO v_tax_account_id
  FROM public.chart_of_accounts
  WHERE tenant_id = p_tenant_id AND account_code = '2100'
    AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
  LIMIT 1;

  IF v_ar_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  IF v_tax > 0 AND v_tax_account_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.journal_entries (
    tenant_id, entry_number, entry_date, description, reference,
    source_type, source_id, status, total_debits, total_credits,
    currency, posted_at, posted_by, created_by
  ) VALUES (
    p_tenant_id,
    'ISS-' || left(replace(p_invoice_id::text, '-', ''), 12),
    COALESCE(v_invoice.issue_date, CURRENT_DATE),
    'Invoice issued: ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
    v_invoice.invoice_number,
    'invoice_issue', p_invoice_id, 'posted', v_amount, v_amount,
    v_currency, now(), p_actor_user_id, p_actor_user_id
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines (
    tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
    description, entity_type, entity_id, currency
  ) VALUES (
    p_tenant_id, v_entry_id, 1, v_ar_account_id, v_amount, 0,
    'Accounts receivable - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
    'invoice', p_invoice_id, v_currency
  );

  INSERT INTO public.journal_entry_lines (
    tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
    description, entity_type, entity_id, currency
  ) VALUES (
    p_tenant_id, v_entry_id, 2, v_revenue_account_id, 0, v_revenue_share,
    'Revenue recognized - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
    'invoice', p_invoice_id, v_currency
  );

  IF v_tax > 0 THEN
    INSERT INTO public.journal_entry_lines (
      tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
      description, entity_type, entity_id, currency
    ) VALUES (
      p_tenant_id, v_entry_id, 3, v_tax_account_id, 0, v_tax,
      'Sales tax payable - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
      'invoice', p_invoice_id, v_currency
    );
  END IF;

  RETURN QUERY SELECT true, v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_business_invoice_issue_journal(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_business_invoice_issue_journal(uuid, uuid, uuid)
  TO service_role;
