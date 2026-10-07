import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { requireInvoiceStripeAccount, reconcileInvoiceStripePayment } from '@/lib/stripeInvoiceExecution';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { user, admin } = await requireAuthenticatedUser(req);
    const { invoiceId, paymentIntentId } = z.object({
      invoiceId: z.string().uuid(),
      paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9]+$/),
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
