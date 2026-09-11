-- Quote header and line items must commit or roll back as one unit.
CREATE OR REPLACE FUNCTION public.update_tenant_quote_atomic(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_header jsonb,
  p_items jsonb
) RETURNS public.quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_quote public.quotes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = p_quote_id AND tenant_id = p_tenant_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  UPDATE public.quotes SET
    name = p_header->>'name',
    status = p_header->>'status',
    valid_until = NULLIF(p_header->>'valid_until', '')::date,
    notes = NULLIF(p_header->>'notes', ''),
    terms_and_conditions = NULLIF(p_header->>'terms_and_conditions', ''),
    currency = upper(p_header->>'currency'),
    subtotal = (p_header->>'subtotal')::numeric,
    discount_amount = (p_header->>'discount_amount')::numeric,
    tax_amount = (p_header->>'tax_amount')::numeric,
    total_amount = (p_header->>'total_amount')::numeric,
    updated_at = now()
  WHERE id = p_quote_id AND tenant_id = p_tenant_id
  RETURNING * INTO updated_quote;

  DELETE FROM public.quote_items WHERE quote_id = p_quote_id AND tenant_id = p_tenant_id;

  INSERT INTO public.quote_items (
    id, tenant_id, quote_id, product_name, description, quantity, unit_price,
    discount_percent, tax_percent, line_total, item_order
  )
  SELECT
    COALESCE(item.id, gen_random_uuid()), p_tenant_id, p_quote_id, item.product_name, NULLIF(item.description, ''),
    item.quantity, item.unit_price, item.discount_percent, item.tax_percent,
    item.line_total, item.item_order
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::jsonb)) AS item(
    id uuid, product_name text, description text, quantity numeric, unit_price numeric,
    discount_percent numeric, tax_percent numeric, line_total numeric, item_order integer
  );

  RETURN updated_quote;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenant_quote_atomic(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_quote_atomic(uuid, uuid, jsonb, jsonb) TO service_role;
