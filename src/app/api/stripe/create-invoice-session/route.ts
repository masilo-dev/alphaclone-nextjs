import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabaseServer';

export async function POST(req: Request) {
    try {
        const { invoiceId, successUrl, cancelUrl } = await req.json();

        if (!invoiceId) {
            return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // 1. Fetch invoice details
        const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('business_invoices')
            .select('*, tenant:tenant_id(name)')
            .eq('id', invoiceId)
            .single();

        if (invoiceError || !invoice) {
            console.error('Invoice fetch error:', invoiceError);
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // 2. Check if tenant has a connected Stripe account for Direct Charges
        const { data: tenantData, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('stripe_connect_id, stripe_connect_onboarded')
            .eq('id', invoice.tenant_id)
            .single();

        const stripeConnectId = (tenantData?.stripe_connect_onboarded && tenantData?.stripe_connect_id)
            ? tenantData.stripe_connect_id
            : null;

        // 3. Create Stripe Checkout Session
        const sessionOptions: any = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Invoice #${invoice.invoice_number}`,
                            description: `Payment for services - ${invoice.tenant?.name || 'AlphaClone Business'}`,
                        },
                        unit_amount: Math.round(invoice.total * 100), // Stripe expects cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment', // One-time payment
            success_url: successUrl || `${req.headers.get('origin')}/invoice/${invoiceId}?payment=success`,
            cancel_url: cancelUrl || `${req.headers.get('origin')}/invoice/${invoiceId}?payment=cancelled`,
            metadata: {
                invoiceId: invoice.id,
                tenantId: invoice.tenant_id,
                type: 'business_invoice'
            },
        };

        // If using Stripe Connect (Direct Charge)
        if (stripeConnectId) {
            console.log(`Using Direct Charge for Connect Account: ${stripeConnectId}`);
            // No platform fee for now as requested
        }

        const session = await stripe.checkout.sessions.create(
            sessionOptions,
            stripeConnectId ? { stripeAccount: stripeConnectId } : undefined
        );

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Invoice Session Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
