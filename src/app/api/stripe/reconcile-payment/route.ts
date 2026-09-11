import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordInvoicePaymentServer } from '@/lib/invoices/recordInvoicePaymentServer';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });

    try {
        const { paymentIntentId, invoiceId } = await req.json();

        if (!paymentIntentId) {
            return NextResponse.json({ error: 'paymentIntentId required' }, { status: 400 });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        const reconciled = paymentIntent.status === 'succeeded';
        const amount = paymentIntent.amount / 100;

        if (reconciled && invoiceId) {
            const admin = createSupabaseAdminClient();
            const { data: invoice } = await admin
                .from('business_invoices')
                .select('id, status, tenant_id, total, amount_paid, invoice_number')
                .eq('id', invoiceId)
                .maybeSingle();

            if (invoice && invoice.status !== 'paid') {
                const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
                const paymentAmount = remaining > 0 ? Math.min(amount, remaining) : amount;

                await recordInvoicePaymentServer(admin, {
                    tenantId: invoice.tenant_id,
                    invoiceId: invoice.id,
                    amount: paymentAmount,
                    idempotencyKey: `stripe:${paymentIntentId}`,
                    source: 'stripe',
                    externalReference: paymentIntentId,
                    actorUserId: user.id,
                });

                await admin.from('stripe_payments').upsert({
                    stripe_payment_intent_id: paymentIntentId,
                    tenant_id: invoice.tenant_id,
                    amount_cents: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: 'succeeded',
                    paid_at: new Date().toISOString(),
                }, { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true });
            }
        }

        return NextResponse.json({
            reconciled,
            status: paymentIntent.status,
            amount,
            currency: paymentIntent.currency,
            paymentIntentId,
        });
    } catch (err: unknown) {
        console.error('[Reconcile Payment]', err);
        return clientErrorResponse(err, { request: req, scope: 'stripe/reconcile-payment' });
    }
}
