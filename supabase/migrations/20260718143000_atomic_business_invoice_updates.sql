ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS bank_details TEXT,
  ADD COLUMN IF NOT EXISTS mobile_payment_details TEXT,
  ADD COLUMN IF NOT EXISTS signature JSONB;

CREATE OR REPLACE FUNCTION public.update_business_invoice_atomic(
  p_tenant_id UUID,
  p_invoice_id UUID,
  p_updates JSONB,
  p_items JSONB DEFAULT NULL
) RETURNS SETOF public.business_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_invoices
  SET
    client_id = CASE WHEN p_updates ? 'client_id' THEN NULLIF(p_updates->>'client_id', '')::UUID ELSE client_id END,
    project_id = CASE WHEN p_updates ? 'project_id' THEN NULLIF(p_updates->>'project_id', '')::UUID ELSE project_id END,
    issue_date = CASE WHEN p_updates ? 'issue_date' THEN (p_updates->>'issue_date')::DATE ELSE issue_date END,
    due_date = CASE WHEN p_updates ? 'due_date' THEN (p_updates->>'due_date')::DATE ELSE due_date END,
    status = CASE WHEN p_updates ? 'status' THEN p_updates->>'status' ELSE status END,
    subtotal = CASE WHEN p_updates ? 'subtotal' THEN (p_updates->>'subtotal')::NUMERIC ELSE subtotal END,
    tax_rate = CASE WHEN p_updates ? 'tax_rate' THEN (p_updates->>'tax_rate')::NUMERIC ELSE tax_rate END,
    tax = CASE WHEN p_updates ? 'tax' THEN (p_updates->>'tax')::NUMERIC ELSE tax END,
    discount_amount = CASE WHEN p_updates ? 'discount_amount' THEN (p_updates->>'discount_amount')::NUMERIC ELSE discount_amount END,
    total = CASE WHEN p_updates ? 'total' THEN (p_updates->>'total')::NUMERIC ELSE total END,
    line_items = CASE WHEN p_updates ? 'line_items' THEN p_updates->'line_items' ELSE line_items END,
    notes = CASE WHEN p_updates ? 'notes' THEN p_updates->>'notes' ELSE notes END,
    is_public = CASE WHEN p_updates ? 'is_public' THEN (p_updates->>'is_public')::BOOLEAN ELSE is_public END,
    sender_name = CASE WHEN p_updates ? 'sender_name' THEN p_updates->>'sender_name' ELSE sender_name END,
    bank_details = CASE WHEN p_updates ? 'bank_details' THEN p_updates->>'bank_details' ELSE bank_details END,
    mobile_payment_details = CASE WHEN p_updates ? 'mobile_payment_details' THEN p_updates->>'mobile_payment_details' ELSE mobile_payment_details END,
    signature = CASE WHEN p_updates ? 'signature' THEN p_updates->'signature' ELSE signature END,
    paid_at = CASE
      WHEN p_updates->>'status' = 'paid' THEN COALESCE(paid_at, now())
      WHEN p_updates ? 'status' AND p_updates->>'status' <> 'paid' THEN NULL
      ELSE paid_at
    END,
    delivery_status = CASE WHEN p_updates->>'status' = 'paid' THEN 'DELIVERED' ELSE delivery_status END,
    updated_at = now()
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF p_items IS NOT NULL THEN
    DELETE FROM public.invoice_line_items WHERE invoice_id = p_invoice_id AND tenant_id = p_tenant_id;
    INSERT INTO public.invoice_line_items (invoice_id, tenant_id, description, quantity, unit_price)
    SELECT p_invoice_id, p_tenant_id, item->>'description', (item->>'quantity')::NUMERIC, (item->>'unit_price')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN QUERY SELECT * FROM public.business_invoices WHERE id = p_invoice_id AND tenant_id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_business_invoice_atomic(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_business_invoice_atomic(UUID, UUID, JSONB, JSONB) TO service_role;
