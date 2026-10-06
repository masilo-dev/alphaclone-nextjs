-- Cumulative rounding makes partial tax reversals equal the original posted tax.
CREATE OR REPLACE FUNCTION public.reconcile_stripe_invoice_refund(p_tenant_id uuid,p_invoice_id uuid,p_payment_intent_id text,p_refunded_amount numeric,p_account_id text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice public.business_invoices%ROWTYPE; v_payment public.business_invoice_payments%ROWTYPE;
 v_old numeric; v_delta numeric; v_tax numeric; v_cash uuid; v_revenue uuid; v_tax_account uuid; v_entry uuid; v_adjustment uuid;
BEGIN
 SELECT * INTO v_invoice FROM public.business_invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 PERFORM 1 FROM public.stripe_payments WHERE tenant_id=p_tenant_id AND stripe_payment_intent_id=p_payment_intent_id
 AND metadata->>'stripe_account_id'=p_account_id AND metadata->>'invoice_id'=p_invoice_id::text;
 IF NOT FOUND THEN RAISE EXCEPTION 'Refund connected account mapping mismatch'; END IF;
 SELECT * INTO v_payment FROM public.business_invoice_payments WHERE tenant_id=p_tenant_id AND invoice_id=p_invoice_id AND idempotency_key='stripe:'||p_payment_intent_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original invoice payment not yet reconciled'; END IF;
 IF p_refunded_amount<0 OR p_refunded_amount>v_payment.amount THEN RAISE EXCEPTION 'Invalid refund total'; END IF;
 INSERT INTO public.stripe_invoice_refund_totals(tenant_id,payment_intent_id,invoice_id) VALUES(p_tenant_id,p_payment_intent_id,p_invoice_id) ON CONFLICT DO NOTHING;
 SELECT amount INTO v_old FROM public.stripe_invoice_refund_totals WHERE tenant_id=p_tenant_id AND payment_intent_id=p_payment_intent_id FOR UPDATE;
 v_delta=p_refunded_amount-v_old;
 IF v_delta<=0 THEN RETURN 0; END IF;
 IF v_delta>COALESCE(v_invoice.amount_paid,0) THEN RAISE EXCEPTION 'Refund exceeds verified invoice balance'; END IF;
 SELECT id INTO v_cash FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='1000' AND deleted_at IS NULL AND is_active IS DISTINCT FROM false LIMIT 1;
 SELECT id INTO v_revenue FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code IN('4100','4000') AND deleted_at IS NULL AND is_active IS DISTINCT FROM false ORDER BY account_code DESC LIMIT 1;
 SELECT id INTO v_tax_account FROM public.chart_of_accounts WHERE tenant_id=p_tenant_id AND account_code='2100' AND deleted_at IS NULL AND is_active IS DISTINCT FROM false LIMIT 1;
 v_tax=CASE WHEN v_invoice.total>0 THEN round(p_refunded_amount*GREATEST(COALESCE(v_invoice.tax,0),0)/v_invoice.total,2)-round(v_old*GREATEST(COALESCE(v_invoice.tax,0),0)/v_invoice.total,2) ELSE 0 END;
 IF v_cash IS NULL OR v_revenue IS NULL OR (v_tax>0 AND v_tax_account IS NULL) THEN RAISE EXCEPTION 'Refund accounting accounts missing'; END IF;
 INSERT INTO public.invoice_adjustments(tenant_id,invoice_id,adjustment_type,amount,reason,posted_at,source_id)
 VALUES(p_tenant_id,p_invoice_id,'refund',v_delta,'Stripe refund '||p_payment_intent_id,now(),v_payment.id) RETURNING id INTO v_adjustment;
 INSERT INTO public.journal_entries(tenant_id,entry_number,entry_date,description,reference,source_type,source_id,status,total_debits,total_credits,currency,posted_at)
 VALUES(p_tenant_id,'REF-'||left(replace(v_adjustment::text,'-',''),12),CURRENT_DATE,'Verified Stripe invoice refund',p_payment_intent_id,'invoice_refund',v_adjustment,'posted',v_delta,v_delta,v_invoice.currency,now()) RETURNING id INTO v_entry;
 INSERT INTO public.journal_entry_lines(tenant_id,entry_id,line_number,account_id,debit_amount,credit_amount,description,entity_type,entity_id,currency) VALUES
 (p_tenant_id,v_entry,1,v_cash,0,v_delta,'Refund cash reversal','invoice',p_invoice_id,v_invoice.currency),
 (p_tenant_id,v_entry,2,v_revenue,v_delta-v_tax,0,'Refund revenue reversal','invoice',p_invoice_id,v_invoice.currency);
 IF v_tax>0 THEN INSERT INTO public.journal_entry_lines(tenant_id,entry_id,line_number,account_id,debit_amount,credit_amount,description,entity_type,entity_id,currency)
 VALUES(p_tenant_id,v_entry,3,v_tax_account,v_tax,0,'Refund tax reversal','invoice',p_invoice_id,v_invoice.currency); END IF;
 UPDATE public.business_invoices SET amount_paid=amount_paid-v_delta,
 status=CASE WHEN status IN('void','cancelled','disputed') THEN status WHEN amount_paid-v_delta>=total THEN 'paid' WHEN amount_paid-v_delta>0 THEN 'partially_paid' ELSE 'sent' END,
 paid_at=NULL,updated_at=now() WHERE id=p_invoice_id AND tenant_id=p_tenant_id;
 UPDATE public.finance_payments SET status=CASE WHEN p_refunded_amount>=v_payment.amount THEN 'refunded' ELSE 'partially_refunded' END,updated_at=now()
 WHERE tenant_id=p_tenant_id AND legacy_source_id=v_payment.id;
 UPDATE public.stripe_invoice_refund_totals SET amount=p_refunded_amount WHERE tenant_id=p_tenant_id AND payment_intent_id=p_payment_intent_id;
 DELETE FROM public.stripe_invoice_attempts WHERE invoice_id=p_invoice_id AND tenant_id=p_tenant_id AND settled_payment_intent=p_payment_intent_id;
 RETURN v_delta;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_stripe_invoice_refund(uuid,uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stripe_invoice_refund(uuid,uuid,text,numeric,text) TO service_role;
