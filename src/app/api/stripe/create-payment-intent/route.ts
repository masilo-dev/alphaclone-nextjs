import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { amount, currency, description, invoiceId, tenantId } = await req.json();

        if (!amount || !currency) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        let stripeConnectId = null;

        // 1. If tenantId provided, check for connected Stripe account
        if (tenantId) {
            const supabaseAdmin = createAdminClient();
            const { data: tenant } = await supabaseAdmin
                .from('tenants')
                .select('stripe_connect_id, stripe_connect_onboarded')
                .eq('id', tenantId)
                .single();

            if (tenant?.stripe_connect_onboarded && tenant?.stripe_connect_id) {
                stripeConnectId = tenant.stripe_connect_id;
            }
        }

        // 2. Create Payment Intent
        const paymentIntentOptions: any = {
            amount: Math.round(amount * 100), // Convert to cents
            currency,
            description: description || (invoiceId ? `Invoice #${invoiceId}` : 'AlphaClone Payment'),
            metadata: {
                invoiceId,
                tenantId,
                integration: 'alphaclone_payment_service'
            },
            automatic_payment_methods: {
                enabled: true,
            },
        };

        const paymentIntent = await stripe.paymentIntents.create(
            paymentIntentOptions,
            stripeConnectId ? { stripeAccount: stripeConnectId } : undefined
        );

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        });

    } catch (error: any) {
        console.error('Stripe PaymentIntent error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
