import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createSupabaseServerClient } from '@/lib/supabase-server';
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

        // Fetch the actual payment from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        const reconciled = paymentIntent.status === 'succeeded';
        const amount = paymentIntent.amount / 100; // Convert cents to dollars

        // If reconciled and we have an invoice, update it
        if (reconciled && invoiceId) {
            const { data: invoice } = await supabase
                .from('business_invoices')
                .select('id, status, tenant_id')
                .eq('id', invoiceId)
                .maybeSingle();

            if (invoice && invoice.status !== 'paid') {
                await supabase
                    .from('business_invoices')
                    .update({ status: 'paid', updated_at: new Date().toISOString() })
                    .eq('id', invoiceId);

                // Record in stripe_payments if not already there
                await supabase.from('stripe_payments').upsert({
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
