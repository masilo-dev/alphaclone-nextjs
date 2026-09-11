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
        const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('business_invoices')
            .select('id,tenant_id,client_id,total,amount_paid,currency,invoice_number,status,notes')
            .eq('id', invoiceId)
            .single();
        if (invoiceError || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        const { data: membership } = await supabaseAdmin.from('tenant_users').select('user_id').eq('tenant_id', invoice.tenant_id).eq('user_id', user.id).maybeSingle();
        if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (invoice.status === 'paid') return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });
        const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
        const amount = remaining > 0 ? remaining : Number(invoice.total || 0);
        const currency = String(invoice.currency || 'usd').toLowerCase();
        const description = invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : `Invoice ${invoiceId}`;
        const tenantId = invoice.tenant_id;

        let stripeConnectId = null;

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

        const paymentIntentOptions: any = {
            amount: Math.round(amount * 100),
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

        if (stripeConnectId) {
            paymentIntentOptions.transfer_data = { destination: stripeConnectId };
            paymentIntentOptions.application_fee_amount = Math.round(amount * 100 * 0.02);
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount,
            currency,
        });
    } catch (err: unknown) {
        return routeErrorResponse(err, 'Failed to create payment intent', req as any);
    }
}
