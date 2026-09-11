import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { requireTenantRole } from '@/lib/apiAuth';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { PLAN_PRICING, type SubscriptionPlan } from '@/services/tenancy/types';
import { z } from 'zod';

export async function POST(req: Request) {
    try {
        const { planId, tenantId, successUrl, cancelUrl } = z.object({
            planId: z.enum(['free', 'starter', 'pro', 'enterprise']),
            tenantId: z.string().uuid(),
            successUrl: z.string().url().optional(),
            cancelUrl: z.string().url().optional(),
            priceId: z.string().optional(),
            adminEmail: z.string().optional(),
        }).parse(await req.json());

        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);

        // Free plan bypass
        if (planId === 'free') {
            const admin = createSupabaseAdminClient();
            await admin.from('tenants').update({
                subscription_plan: 'free',
                subscription_status: 'free',
                updated_at: new Date().toISOString()
            }).eq('id', tenantId);

            return NextResponse.json({ url: successUrl || '/dashboard?checkout=free_active' });
        }

        const priceId = PLAN_PRICING[planId as SubscriptionPlan]?.stripePriceId;
        if (!priceId) {
            return NextResponse.json({ error: `Price ID for plan ${planId} is not configured` }, { status: 503 });
        }

        // Fetch existing tenant record to check for Stripe customer ID
        const admin = createSupabaseAdminClient();
        const { data: tenant } = await admin
            .from('tenants')
            .select('stripe_customer_id')
            .eq('id', tenantId)
            .single();

        const origin = new URL(req.url).origin;
        const safeReturnUrl = (value: string | undefined, fallback: string) => {
            if (!value) return `${origin}${fallback}`;
            return new URL(value).origin === origin ? value : `${origin}${fallback}`;
        };

        const sessionOptions: any = {
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
            success_url: safeReturnUrl(successUrl, '/dashboard?checkout=success'),
            cancel_url: safeReturnUrl(cancelUrl, '/dashboard?checkout=cancelled'),
            metadata: {
                tenantId,
                userId: user.id,
                planId,
                plan: planId,
            },
            subscription_data: {
                metadata: {
                    tenantId,
                    userId: user.id,
                    planId,
                    plan: planId,
                },
            },
        };

        // Reuse existing customer or pass customer_email
        if (tenant?.stripe_customer_id) {
            sessionOptions.customer = tenant.stripe_customer_id;
        } else {
            sessionOptions.customer_email = user.email;
        }

        const session = await stripe.checkout.sessions.create(sessionOptions);

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'stripe/create-checkout-session' });
    }
}
