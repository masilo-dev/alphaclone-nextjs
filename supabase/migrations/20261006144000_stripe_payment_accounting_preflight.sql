-- Fail before provider creation if verified payment cannot be recorded.
CREATE OR REPLACE FUNCTION public.claim_stripe_invoice_attempt(p_tenant_id uuid,p_invoice_id uuid,p_account_id text,p_kind text,p_amount_minor bigint,p_currency text)
RETURNS SETOF public.stripe_invoice_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice public.business_invoices%ROWTYPE; v_account text;
BEGIN
 SELECT * INTO v_invoice FROM public.business_invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND OR v_invoice.status NOT IN ('sent','viewed','overdue','partially_paid') OR COALESCE(v_invoice.amount_paid,0)>=v_invoice.total THEN RAISE EXCEPTION 'Invoice is not payable'; END IF;
 IF lower(COALESCE(v_invoice.currency,'usd'))<>lower(p_currency) OR p_amount_minor<>round((v_invoice.total-COALESCE(v_invoice.amount_paid,0))*CASE WHEN lower(p_currency) IN('bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','vnd','vuv','xaf','xof','xpf') THEN 1 ELSE 100 END) THEN RAISE EXCEPTION 'Invoice amount or currency changed'; END IF;
 SELECT stripe_connect_id INTO v_account FROM public.tenants WHERE id=p_tenant_id;
 IF v_account IS DISTINCT FROM p_account_id OR NULLIF(p_account_id,'') IS NULL THEN RAISE EXCEPTION 'Connected account mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='1000' AND deleted_at IS NULL AND is_active IS DISTINCT FROM false)
 OR NOT EXISTS(SELECT 1 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code IN('4000','4100') AND deleted_at IS NULL AND is_active IS DISTINCT FROM false)
 OR (COALESCE(v_invoice.tax,0)>0 AND NOT EXISTS(SELECT 1 FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='2100' AND deleted_at IS NULL AND is_active IS DISTINCT FROM false))
 THEN RAISE EXCEPTION 'Set up accounting before accepting online invoice payments'; END IF;
 INSERT INTO public.stripe_invoice_attempts(invoice_id,tenant_id,stripe_account_id,kind,amount_minor,currency)
 VALUES(p_invoice_id,p_tenant_id,p_account_id,p_kind,p_amount_minor,lower(p_currency)) ON CONFLICT(invoice_id) DO NOTHING;
 RETURN QUERY SELECT * FROM public.stripe_invoice_attempts WHERE invoice_id=p_invoice_id AND tenant_id=p_tenant_id;
END $$;
