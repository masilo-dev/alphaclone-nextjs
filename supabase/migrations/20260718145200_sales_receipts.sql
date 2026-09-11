CREATE TABLE IF NOT EXISTS public.sales_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  receipt_date date NOT NULL,
  client_name text NOT NULL,
  client_email text,
  payment_method text NOT NULL,
  subtotal numeric(15,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax numeric(15,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(15,2) NOT NULL CHECK (total > 0),
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  received_by text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.sales_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.sales_receipts(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  description text NOT NULL,
  quantity numeric(15,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  amount numeric(15,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (receipt_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_receipts_tenant_date ON public.sales_receipts (tenant_id, receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_items_receipt ON public.sales_receipt_items (receipt_id, line_number);

ALTER TABLE public.sales_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_receipt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_receipts_tenant_access ON public.sales_receipts;
CREATE POLICY sales_receipts_tenant_access ON public.sales_receipts FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS sales_receipt_items_tenant_access ON public.sales_receipt_items;
CREATE POLICY sales_receipt_items_tenant_access ON public.sales_receipt_items FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.create_posted_sales_receipt(
  p_tenant_id uuid,
  p_receipt_number text,
  p_receipt_date date,
  p_client_name text,
  p_client_email text,
  p_payment_method text,
  p_subtotal numeric,
  p_discount_amount numeric,
  p_tax_rate numeric,
  p_tax numeric,
  p_total numeric,
  p_currency text,
  p_notes text,
  p_received_by text,
  p_items jsonb,
  p_actor_user_id uuid
) RETURNS SETOF public.sales_receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_receipt public.sales_receipts%ROWTYPE;
  v_entry_id uuid;
  v_cash_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_item jsonb;
  v_line integer := 0;
  v_net_revenue numeric;
BEGIN
  IF p_total <= 0 OR p_subtotal < 0 OR p_discount_amount < 0 OR p_tax < 0 THEN
    RAISE EXCEPTION 'Sales receipt totals are invalid';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sales receipt item is required';
  END IF;

  SELECT id INTO v_cash_account_id FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '1000' AND deleted_at IS NULL AND is_active IS DISTINCT FROM false LIMIT 1;
  SELECT id INTO v_revenue_account_id FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code IN ('4100','4000') AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
    ORDER BY account_code DESC LIMIT 1;
  SELECT id INTO v_tax_account_id FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '2100' AND deleted_at IS NULL AND is_active IS DISTINCT FROM false LIMIT 1;
  IF v_cash_account_id IS NULL OR v_revenue_account_id IS NULL OR (p_tax > 0 AND v_tax_account_id IS NULL) THEN
    RAISE EXCEPTION 'Required accounting accounts are missing; initialize Cash (1000), Revenue (4100/4000), and Sales Tax Payable (2100)';
  END IF;

  INSERT INTO public.sales_receipts (
    tenant_id, receipt_number, receipt_date, client_name, client_email, payment_method,
    subtotal, discount_amount, tax_rate, tax, total, currency, notes, received_by, created_by
  ) VALUES (
    p_tenant_id, trim(p_receipt_number), p_receipt_date, trim(p_client_name), NULLIF(trim(p_client_email), ''),
    trim(p_payment_method), p_subtotal, p_discount_amount, p_tax_rate, p_tax, p_total,
    COALESCE(NULLIF(trim(p_currency), ''), 'USD'), NULLIF(trim(p_notes), ''), NULLIF(trim(p_received_by), ''), p_actor_user_id
  ) RETURNING * INTO v_receipt;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_line := v_line + 1;
    INSERT INTO public.sales_receipt_items (tenant_id, receipt_id, line_number, description, quantity, unit_price, amount)
    VALUES (
      p_tenant_id, v_receipt.id, v_line, trim(v_item->>'description'),
      (v_item->>'quantity')::numeric, (v_item->>'unitPrice')::numeric, (v_item->>'amount')::numeric
    );
  END LOOP;

  v_net_revenue := p_total - p_tax;
  INSERT INTO public.journal_entries (
    tenant_id, entry_number, entry_date, description, reference, source_type, source_id,
    status, total_debits, total_credits, currency, posted_at, posted_by, created_by
  ) VALUES (
    p_tenant_id, 'SALE-' || left(replace(v_receipt.id::text, '-', ''), 12), p_receipt_date,
    'Sales receipt ' || p_receipt_number, p_receipt_number, 'sales_receipt', v_receipt.id,
    'posted', p_total, p_total, COALESCE(NULLIF(trim(p_currency), ''), 'USD'), now(), p_actor_user_id, p_actor_user_id
  ) RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines (
    tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount, description, entity_type, entity_id, currency
  ) VALUES
    (p_tenant_id, v_entry_id, 1, v_cash_account_id, p_total, 0, 'Cash received - ' || p_receipt_number, 'sales_receipt', v_receipt.id, COALESCE(NULLIF(trim(p_currency), ''), 'USD')),
    (p_tenant_id, v_entry_id, 2, v_revenue_account_id, 0, v_net_revenue, 'Revenue - ' || p_receipt_number, 'sales_receipt', v_receipt.id, COALESCE(NULLIF(trim(p_currency), ''), 'USD'));
  IF p_tax > 0 THEN
    INSERT INTO public.journal_entry_lines (
      tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount, description, entity_type, entity_id, currency
    ) VALUES (p_tenant_id, v_entry_id, 3, v_tax_account_id, 0, p_tax, 'Sales tax - ' || p_receipt_number, 'sales_receipt', v_receipt.id, COALESCE(NULLIF(trim(p_currency), ''), 'USD'));
  END IF;

  UPDATE public.sales_receipts SET journal_entry_id = v_entry_id WHERE id = v_receipt.id;
  INSERT INTO public.business_automation_events (tenant_id, event_type, payload)
  VALUES (p_tenant_id, 'sales_receipt_created', jsonb_build_object('receiptId', v_receipt.id, 'total', p_total, 'actorUserId', p_actor_user_id));

  RETURN QUERY SELECT * FROM public.sales_receipts WHERE id = v_receipt.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_posted_sales_receipt(uuid,text,date,text,text,text,numeric,numeric,numeric,numeric,numeric,text,text,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_posted_sales_receipt(uuid,text,date,text,text,text,numeric,numeric,numeric,numeric,numeric,text,text,text,jsonb,uuid) TO service_role;
