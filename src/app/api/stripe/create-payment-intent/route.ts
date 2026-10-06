import { invoiceAmountToStripe } from '@/lib/stripeInvoiceCurrency';
import { requireInvoiceStripeAccount } from '@/lib/stripeInvoiceExecution';
import { invoiceOutstanding } from '@/lib/stripePaymentPolicy';
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
        const amount = invoiceOutstanding(invoice);
        const currency = String(invoice.currency || 'usd').toLowerCase();
        const description = invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : `Invoice ${invoiceId}`;
        const tenantId = invoice.tenant_id;

        const stripeConnectId = await requireInvoiceStripeAccount(supabaseAdmin, invoice.tenant_id);

        const paymentIntentOptions: any = {
            amount: invoiceAmountToStripe(amount, currency),
            currency,
            description: description || (invoiceId ? `Invoice #${invoiceId}` : 'Invoice payment'),
            metadata: {
                invoiceId,
                tenantId,
                type: 'business_invoice',
                integration: 'alphaclone_payment_service'
            },
            automatic_payment_methods: {
                enabled: true,
            },
        };

        // Tenant customer payments are direct charges on the tenant's connected
        // Stripe account. AlphaClone does not collect or redistribute these funds.
        const paymentIntent = await stripe.paymentIntents.create(
            paymentIntentOptions,
            { stripeAccount: stripeConnectId, idempotencyKey: `invoice-intent:${invoice.id}:${invoiceAmountToStripe(amount, currency)}:${currency}` }
        );

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            stripeAccountId: stripeConnectId,
            amount,
            currency,
        });
    } catch (err: unknown) {
        return routeErrorResponse(err, 'Failed to create payment intent', req as any);
    }
}
