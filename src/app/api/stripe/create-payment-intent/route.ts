import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { user } = await requireAuthenticatedUser(req);
        const { invoiceId } = z.object({ invoiceId: z.string().uuid() }).parse(await req.json());
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: invoice, error: invoiceError } = await supabaseAdmin.from('invoices').select('id,tenant_id,user_id,amount,currency,description,status').eq('id', invoiceId).single();
        if (invoiceError || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        const { data: membership } = await supabaseAdmin.from('tenant_users').select('user_id').eq('tenant_id', invoice.tenant_id).eq('user_id', user.id).maybeSingle();
        if (invoice.user_id !== user.id && !membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (invoice.status === 'paid') return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });
        const amount = Number(invoice.amount);
        const currency = String(invoice.currency || 'usd').toLowerCase();
        const description = invoice.description;
        const tenantId = invoice.tenant_id;

        let stripeConnectId = null;

        // 1. If tenantId provided, check for connected Stripe account
        if (tenantId) {
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
        return routeErrorResponse(error, 'Payment initialization failed', req);
    }
}
