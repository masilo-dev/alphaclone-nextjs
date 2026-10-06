import 'server-only';
import { stripe } from '@/lib/stripe';
type InvoiceProviderAttempt = { id: string; status?: string | null; url?: string | null; client_secret?: string | null };
type RequestOptions = { stripeAccount: string; idempotencyKey: string };
import type { SupabaseClient } from '@supabase/supabase-js';
export async function withInvoicePaymentAttempt(admin: SupabaseClient,
 input: {tenantId:string;invoiceId:string;accountId:string;kind:'checkout'|'intent';amount:number;currency:string},
 create: (options: RequestOptions) => Promise<InvoiceProviderAttempt>, retried = false): Promise<InvoiceProviderAttempt> {
 const {data,error}=await admin.rpc('claim_stripe_invoice_attempt',{
  p_tenant_id:input.tenantId,p_invoice_id:input.invoiceId,p_account_id:input.accountId,p_kind:input.kind,
  p_amount_minor:input.amount,p_currency:input.currency,
 });
 if(error) throw error;
 const attempt=Array.isArray(data)?data[0]:data;
 if(!attempt) throw new Error('Invoice payment reservation unavailable');
 if(attempt.stripe_account_id!==input.accountId || attempt.kind!==input.kind || attempt.amount_minor!==input.amount || attempt.currency!==input.currency.toLowerCase()) {
  throw new Error('Another payment attempt exists for this invoice. Finish or cancel it before changing payment method or amount.');
 }
 const options={stripeAccount:input.accountId,idempotencyKey:`invoice-attempt:${attempt.id}`};
 if(attempt.provider_id) {
  const object = input.kind==='checkout'
   ? await stripe.checkout.sessions.retrieve(attempt.provider_id,{stripeAccount:input.accountId})
   : await stripe.paymentIntents.retrieve(attempt.provider_id,{stripeAccount:input.accountId});
  const terminalCancelled = input.kind==='checkout' ? object.status==='expired' : object.status==='canceled';
  if(terminalCancelled && !retried) {
   const {error:releaseError}=await admin.rpc('release_stripe_invoice_attempt',{p_tenant_id:input.tenantId,p_invoice_id:input.invoiceId,p_attempt_id:attempt.id});
   if(releaseError) throw releaseError;
   return withInvoicePaymentAttempt(admin,input,create,true);
  }
  if(input.kind==='checkout' ? object.status!=='open' : !['requires_payment_method','requires_confirmation','requires_action'].includes(object.status || '')) {
   throw new Error('Payment is processing or completed. Wait for the verified invoice update.');
  }
  return object as InvoiceProviderAttempt;
 }
 // Stripe retains keys for at least 24h. An ambiguous older request must never be recreated blindly.
 if(Date.now()-Date.parse(attempt.created_at)>20*60*60*1000) throw new Error('Unresolved payment attempt requires provider reconciliation');
 const result=await create(options);
 const {error:saveError}=await admin.from('stripe_invoice_attempts').update({provider_id:result.id})
  .eq('invoice_id',input.invoiceId).eq('tenant_id',input.tenantId).eq('id',attempt.id);
 if(saveError) throw saveError;
 return result;
}
