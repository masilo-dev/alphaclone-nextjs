import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { requireTenantAccess } from '@/lib/apiAuth';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
    try {
        const { priceId, planId, tenantId, adminEmail, successUrl, cancelUrl } = await req.json();

        if (!priceId || !tenantId) {
            return NextResponse.json({ error: 'Missing priceId or tenantId' }, { status: 400 });
        }

        await requireTenantAccess(tenantId);

        // Apply discount for starter plan if applicable
        const discounts = [];
        if (planId === 'starter') {
            discounts.push({
                coupon: '3lopMJDs', // START35 coupon ID
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            customer_email: adminEmail,
            discounts,
            success_url: successUrl || `${req.headers.get('origin')}/dashboard?checkout=success`,
            cancel_url: cancelUrl || `${req.headers.get('origin')}/dashboard?checkout=cancelled`,
            metadata: {
                tenantId,
                planId,
                plan: planId,
            },
            subscription_data: {
                trial_period_days: 14,
                metadata: {
                    tenantId,
                    planId,
                    plan: planId,
                },
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'stripe/create-checkout-session' });
    }
}
