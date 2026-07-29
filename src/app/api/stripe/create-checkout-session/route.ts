import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
<<<<<<< HEAD
import { requireTenantRole } from '@/lib/apiAuth';
import { stripe } from '@/lib/stripe';
import { PLAN_PRICING, type SubscriptionPlan } from '@/services/tenancy/types';
import { z } from 'zod';
=======
import { requireTenantAccess } from '@/lib/apiAuth';
import { stripe } from '@/lib/stripe';
>>>>>>> origin/main

export async function POST(req: Request) {
    try {
        const { planId, tenantId, successUrl, cancelUrl } = z.object({
            planId: z.enum(['starter', 'pro', 'enterprise']),
            tenantId: z.string().uuid(),
            successUrl: z.string().url().optional(),
            cancelUrl: z.string().url().optional(),
            priceId: z.string().optional(),
            adminEmail: z.string().optional(),
        }).parse(await req.json());

        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
        const priceId = PLAN_PRICING[planId as SubscriptionPlan].stripePriceId;
        if (!priceId) return NextResponse.json({ error: 'This plan is not configured for checkout' }, { status: 503 });
        const origin = new URL(req.url).origin;
        const safeReturnUrl = (value: string | undefined, fallback: string) => {
            if (!value) return `${origin}${fallback}`;
            return new URL(value).origin === origin ? value : `${origin}${fallback}`;
        };

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
            customer_email: user.email,
            discounts,
            success_url: safeReturnUrl(successUrl, '/dashboard?checkout=success'),
            cancel_url: safeReturnUrl(cancelUrl, '/dashboard?checkout=cancelled'),
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
