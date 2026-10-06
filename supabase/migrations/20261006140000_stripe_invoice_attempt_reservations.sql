-- A single durable provider attempt per invoice, shared by Checkout and Elements.
CREATE TABLE public.stripe_invoice_attempts (
 invoice_id uuid PRIMARY KEY REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 stripe_account_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('checkout','intent')),
 amount_minor bigint NOT NULL CHECK(amount_minor > 0), currency text NOT NULL,
 provider_id text, settled_payment_intent text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_invoice_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_invoice_attempts FROM anon, authenticated;
GRANT ALL ON public.stripe_invoice_attempts TO service_role;
CREATE FUNCTION public.claim_stripe_invoice_attempt(p_tenant_id uuid,p_invoice_id uuid,p_account_id text,p_kind text,p_amount_minor bigint,p_currency text)
RETURNS SETOF public.stripe_invoice_attempts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice public.business_invoices%ROWTYPE; v_account text;
BEGIN
 SELECT * INTO v_invoice FROM public.business_invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND OR v_invoice.status NOT IN ('sent','viewed','overdue','partially_paid') OR COALESCE(v_invoice.amount_paid,0)>=v_invoice.total THEN RAISE EXCEPTION 'Invoice is not payable'; END IF;
 IF lower(COALESCE(v_invoice.currency,'usd'))<>lower(p_currency) OR p_amount_minor<>round((v_invoice.total-COALESCE(v_invoice.amount_paid,0))*CASE WHEN lower(p_currency) IN('bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','vnd','vuv','xaf','xof','xpf') THEN 1 ELSE 100 END) THEN RAISE EXCEPTION 'Invoice amount or currency changed'; END IF;
 SELECT stripe_connect_id INTO v_account FROM public.tenants WHERE id=p_tenant_id;
 IF v_account IS DISTINCT FROM p_account_id OR NULLIF(p_account_id,'') IS NULL THEN RAISE EXCEPTION 'Connected account mismatch'; END IF;
 INSERT INTO public.stripe_invoice_attempts(invoice_id,tenant_id,stripe_account_id,kind,amount_minor,currency)
 VALUES(p_invoice_id,p_tenant_id,p_account_id,p_kind,p_amount_minor,lower(p_currency)) ON CONFLICT(invoice_id) DO NOTHING;
 RETURN QUERY SELECT * FROM public.stripe_invoice_attempts WHERE invoice_id=p_invoice_id AND tenant_id=p_tenant_id;
END $$;
CREATE FUNCTION public.release_stripe_invoice_attempt(p_tenant_id uuid,p_invoice_id uuid,p_attempt_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Called only after the scoped provider confirms cancellation or expiration.
 PERFORM 1 FROM public.business_invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id FOR UPDATE;
 DELETE FROM public.stripe_invoice_attempts WHERE invoice_id=p_invoice_id AND tenant_id=p_tenant_id AND id=p_attempt_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_stripe_invoice_attempt(uuid,uuid,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_stripe_invoice_attempt(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_invoice_attempt(uuid,uuid,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stripe_invoice_attempt(uuid,uuid,uuid) TO service_role;
