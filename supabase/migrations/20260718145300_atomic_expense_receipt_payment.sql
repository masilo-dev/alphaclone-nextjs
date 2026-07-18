CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_expense_receipt_source
  ON public.journal_entries (tenant_id, source_type, source_id)
  WHERE source_type = 'expense_receipt';

CREATE OR REPLACE FUNCTION public.pay_business_receipt(
  p_tenant_id uuid,
  p_receipt_id uuid,
  p_asset_account_id uuid,
  p_actor_user_id uuid
) RETURNS SETOF public.business_receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_receipt public.business_receipts%ROWTYPE;
  v_expense_account_id uuid;
  v_asset_account_id uuid;
  v_entry_id uuid;
BEGIN
  SELECT * INTO v_receipt FROM public.business_receipts
    WHERE tenant_id = p_tenant_id AND id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense receipt not found'; END IF;
  IF v_receipt.status = 'void' THEN RAISE EXCEPTION 'A void expense receipt cannot be paid'; END IF;
  IF v_receipt.status = 'paid' THEN
    RETURN QUERY SELECT * FROM public.business_receipts WHERE tenant_id = p_tenant_id AND id = p_receipt_id;
    RETURN;
  END IF;
  IF v_receipt.amount <= 0 THEN RAISE EXCEPTION 'Expense receipt amount must be greater than zero'; END IF;

  SELECT id INTO v_expense_account_id FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND id = v_receipt.account_id AND account_type = 'expense'
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false LIMIT 1;
  SELECT id INTO v_asset_account_id FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND id = p_asset_account_id AND account_type = 'asset'
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false LIMIT 1;
  IF v_expense_account_id IS NULL THEN RAISE EXCEPTION 'Select a valid expense account before paying this receipt'; END IF;
  IF v_asset_account_id IS NULL THEN RAISE EXCEPTION 'Select a valid cash or bank account for this payment'; END IF;

  INSERT INTO public.journal_entries (
    tenant_id, entry_number, entry_date, description, reference, source_type, source_id,
    status, total_debits, total_credits, currency, posted_at, posted_by, created_by
  ) VALUES (
    p_tenant_id, 'EXP-' || left(replace(v_receipt.id::text, '-', ''), 12), v_receipt.receipt_date,
    'Paid expense receipt: ' || v_receipt.description, COALESCE(v_receipt.vendor, v_receipt.id::text),
    'expense_receipt', v_receipt.id, 'posted', v_receipt.amount, v_receipt.amount,
    'USD', now(), p_actor_user_id, p_actor_user_id
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines (
    tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount, description, entity_type, entity_id, currency
  ) VALUES
    (p_tenant_id, v_entry_id, 1, v_expense_account_id, v_receipt.amount, 0, v_receipt.description, 'expense_receipt', v_receipt.id, 'USD'),
    (p_tenant_id, v_entry_id, 2, v_asset_account_id, 0, v_receipt.amount, 'Payment for ' || v_receipt.description, 'expense_receipt', v_receipt.id, 'USD');

  UPDATE public.business_receipts SET
    status = 'paid', paid_at = now(), journal_entry_id = v_entry_id,
    asset_account_id = v_asset_account_id, updated_at = now()
  WHERE tenant_id = p_tenant_id AND id = p_receipt_id;

  INSERT INTO public.business_automation_events (tenant_id, event_type, payload)
  VALUES (p_tenant_id, 'expense_receipt_paid', jsonb_build_object(
    'receiptId', p_receipt_id, 'amount', v_receipt.amount, 'journalEntryId', v_entry_id, 'actorUserId', p_actor_user_id
  ));

  RETURN QUERY SELECT * FROM public.business_receipts WHERE tenant_id = p_tenant_id AND id = p_receipt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_business_receipt(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_business_receipt(uuid,uuid,uuid,uuid) TO service_role;
