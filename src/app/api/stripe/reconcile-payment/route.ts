import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { requireInvoiceStripeAccount, reconcileInvoiceStripePayment } from '@/lib/stripeInvoiceExecution';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { user, admin } = await requireAuthenticatedUser(req);
    const { invoiceId, paymentIntentId: rawPaymentIntentId } = z.object({
      invoiceId: z.string().uuid(),
      paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9]+$/).optional(),
    }).parse(await req.json());

    const { data: invoice, error } = await admin
      .from('business_invoices')
      .select('tenant_id')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await requireTenantAccess(invoice.tenant_id, req);

    let paymentIntentId = rawPaymentIntentId;
    if (!paymentIntentId) {
      const { data: attempt } = await admin
        .from('stripe_invoice_attempts')
        .select('payment_intent_id, provider_attempt_id')
        .eq('tenant_id', invoice.tenant_id)
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      paymentIntentId = attempt?.payment_intent_id || (attempt?.provider_attempt_id?.startsWith('pi_') ? attempt.provider_attempt_id : undefined);
    }

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID required or none found for this invoice' }, { status: 400 });
    }

    const accountId = await requireInvoiceStripeAccount(admin, invoice.tenant_id);
    const result = await reconcileInvoiceStripePayment(
      admin,
      invoice.tenant_id,
      invoiceId,
      paymentIntentId,
      accountId,
      user.id
    );

    return NextResponse.json({
      reconciled: true,
      status: result.payment.status,
      invoice: result.invoice,
      amount: result.payment.amount_received / 100,
      currency: result.payment.currency,
      paymentIntentId,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Payment could not be verified', req);
  }
}
