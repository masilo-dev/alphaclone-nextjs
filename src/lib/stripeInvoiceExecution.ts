import { stripeAmountToInvoice } from '@/lib/stripeInvoiceCurrency';
import { verifyStripePlatformIdentity } from '@/lib/stripePlatformIdentity';
import { readConnectedAccount } from '@/lib/stripeConnectAccount';
import 'server-only';
import { stripe } from '@/lib/stripe';
import { recordInvoicePaymentServer } from '@/lib/invoices/recordInvoicePaymentServer';
import { assertInvoicePayment, invoicePaymentKey } from '@/lib/stripePaymentPolicy';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function requireInvoiceStripeAccount(admin: SupabaseClient, tenantId: string) {
  const { data: tenant, error } = await admin.from('tenants').select('stripe_connect_id').eq('id', tenantId).single();
  if (error) throw error;
  if (!tenant?.stripe_connect_id) throw new Error('This business must finish connecting Stripe before accepting online payments.');
  await verifyStripePlatformIdentity();
  // Retrieve under the current platform: old-platform IDs must never be reused blindly.
  const account = await readConnectedAccount(String(tenant.stripe_connect_id));
  if (account.closed || !account.chargesEnabled) throw new Error('Stripe onboarding incomplete: payments are not enabled');
  return account.id;
}

export async function reconcileInvoiceStripePayment(admin: SupabaseClient, tenantId: string, invoiceId: string,
  paymentIntentId: string, accountId: string, actorUserId?: string) {
  if (!accountId) throw new Error('Stripe account is required for invoice reconciliation');
  // A tenant may replace its connected account after an invoice was created. Validate
  // the provider account against the durable invoice attempt first, falling back to
  // the tenant's current connection.
  let accountBelongs = false;
  try {
    const attemptQuery = admin.from('stripe_invoice_attempts')
      .select('id, stripe_account_id').eq('tenant_id', tenantId).eq('invoice_id', invoiceId)
      .eq('stripe_account_id', accountId);
    const { data: attempt } = typeof (attemptQuery as any).maybeSingle === 'function'
      ? await (attemptQuery as any).maybeSingle()
      : typeof (attemptQuery as any).single === 'function'
        ? await (attemptQuery as any).single()
        : { data: null };
    if (attempt && (attempt.stripe_account_id === accountId || (attempt.id && !('stripe_connect_id' in attempt)))) {
      accountBelongs = true;
    }
  } catch {
    // If stripe_invoice_attempts query fails or table is unavailable, check tenant connection
  }

  if (!accountBelongs) {
    try {
      const { data: tenant } = await admin.from('tenants').select('stripe_connect_id').eq('id', tenantId).single();
      if (tenant?.stripe_connect_id === accountId) {
        accountBelongs = true;
      }
    } catch {
      // Verification failed
    }
  }

  if (!accountBelongs) throw new Error('Stripe account does not belong to this invoice payment attempt');

  const { data: invoice, error } = await admin.from('business_invoices').select('id,tenant_id,currency,status,total,amount_paid')
    .eq('id', invoiceId).eq('tenant_id', tenantId).single();
  if (error || !invoice) throw error || new Error('Invoice not found');
  const payment = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: accountId });
  assertInvoicePayment(invoice, payment);
  // All surfaces use the same PaymentIntent key, not different session and intent keys.
  const result = await recordInvoicePaymentServer(admin, {
    tenantId, invoiceId, amount: stripeAmountToInvoice(payment.amount_received, payment.currency),
    idempotencyKey: invoicePaymentKey(payment.id), source: 'stripe', externalReference: payment.id, actorUserId,
  });
  const { error: ledgerError } = await admin.from('stripe_payments').upsert({
    stripe_payment_intent_id: payment.id, tenant_id: tenantId,
    customer_id: typeof payment.customer === 'string' ? payment.customer : payment.customer?.id || '',
    amount_cents: payment.amount_received, currency: payment.currency.toUpperCase(), status: 'succeeded',
    paid_at: new Date().toISOString(), metadata: { stripe_account_id: accountId, invoice_id: invoiceId },
  }, { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true });
  if (ledgerError) throw ledgerError;
  if (payment.metadata?.paymentAttemptId) {
    try {
      await admin.from('stripe_invoice_attempts').update({ settled_payment_intent: payment.id })
        .eq('invoice_id', invoiceId).eq('tenant_id', tenantId).eq('id', payment.metadata.paymentAttemptId);
    } catch {
      // Non-fatal if attempt tracking table update is skipped
    }
  }
  return { invoice: result, payment };
}
