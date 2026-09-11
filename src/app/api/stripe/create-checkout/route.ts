import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { stripe } from '@/lib/stripe';
import { PLAN_PRICING, SubscriptionPlan } from '@/services/tenancy/types';
import { requireTenantRole } from '@/lib/apiAuth';
import { isTurnstileEnforced, readClientIp, readTurnstileToken, verifyTurnstileToken } from '@/lib/verifyTurnstile';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { plan, tenantId } = body;
        const turnstileToken = readTurnstileToken(body);

        if (!plan || !tenantId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
        const userId = user.id;

        if (isTurnstileEnforced()) {
            if (!turnstileToken) {
                return NextResponse.json({ error: 'Security verification required' }, { status: 400 });
            }
            const verified = await verifyTurnstileToken(turnstileToken, readClientIp(req));
            if (!verified) {
                return NextResponse.json({ error: 'Security verification failed. Please try again.' }, { status: 403 });
            }
        }

        // Pull pricing from PLAN_PRICING — single source of truth
        const validPlans: SubscriptionPlan[] = ['starter', 'pro', 'enterprise'];
        if (!validPlans.includes(plan as SubscriptionPlan)) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const planConfig = PLAN_PRICING[plan as SubscriptionPlan];
        const planNames: Record<string, string> = {
            starter: 'Starter Plan',
            pro: 'Pro Plan',
            enterprise: 'Enterprise Plan',
        };
        const planName = planNames[plan] || plan;

        // Use Stripe Price ID from PLAN_PRICING if available, otherwise use price_data
        const lineItem = planConfig.stripePriceId
            ? { price: planConfig.stripePriceId, quantity: 1 }
            : {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: planName,
                        description: `AlphaClone ${planName} - Monthly Subscription`,
                    },
                    unit_amount: planConfig.monthly * 100, // cents
                    recurring: { interval: 'month' as const },
                },
                quantity: 1,
            };

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [lineItem],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=cancelled`,
            metadata: {
                tenantId,
                userId,
                plan,
            },
            subscription_data: {
                metadata: {
                    tenantId,
                    userId,
                    plan,
                },
            },
        });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        return clientErrorResponse(error, { request: req, scope: 'stripe/create-checkout' });
    }
}
