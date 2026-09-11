import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

export async function POST(req: Request) {
    try {
        const { invoiceId, publicToken, successUrl, cancelUrl } = z.object({
            invoiceId: z.string().uuid(),
            publicToken: z.string().min(16).max(300).optional(),
            successUrl: z.string().url().optional(),
            cancelUrl: z.string().url().optional(),
        }).parse(await req.json());

        const supabaseAdmin = createSupabaseAdminClient();
        const authClient = await createSupabaseServerClient();
        const { data: { user } } = await authClient.auth.getUser();

        const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('business_invoices')
            .select('*, tenant:tenant_id(name)')
            .eq('id', invoiceId)
            .single();

        if (invoiceError || !invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const metadata = (invoice.metadata || {}) as Record<string, string>;
        const isPublicAccess =
            invoice.is_public &&
            publicToken &&
            metadata.public_token === publicToken;

        let isTenantMember = false;
        if (user) {
            const { data: membership } = await supabaseAdmin.from('tenant_users').select('user_id').eq('tenant_id', invoice.tenant_id).eq('user_id', user.id).maybeSingle();
            isTenantMember = Boolean(membership);
        }
        if (!isTenantMember && !isPublicAccess) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (invoice.status === 'paid') {
            return NextResponse.json({ error: 'Invoice already paid' }, { status: 409 });
        }
        if (!['sent', 'viewed', 'overdue'].includes(invoice.status)) {
            return NextResponse.json({ error: 'Invoice is not payable' }, { status: 409 });
        }

        const { data: tenantData } = await supabaseAdmin
            .from('tenants')
            .select('stripe_connect_id, stripe_connect_onboarded')
            .eq('id', invoice.tenant_id)
            .single();

        const stripeConnectId = (tenantData?.stripe_connect_onboarded && tenantData?.stripe_connect_id)
            ? tenantData.stripe_connect_id
            : null;

        const origin = new URL(req.url).origin;
        const tokenQuery = publicToken ? `&token=${publicToken}` : '';
        const safeReturn = (value: string | undefined, fallback: string) => value && new URL(value).origin === origin ? value : fallback;

        const sessionOptions: any = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: String(invoice.currency || 'usd').toLowerCase(),
                        product_data: {
                            name: `Invoice #${invoice.invoice_number}`,
                            description: `Payment for services - ${invoice.tenant?.name || 'Business'}`,
                        },
                        unit_amount: Math.round(Number(invoice.total || 0) * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: safeReturn(successUrl, `${origin}/invoice/${invoiceId}?payment=success${tokenQuery}`),
            cancel_url: safeReturn(cancelUrl, `${origin}/invoice/${invoiceId}?payment=cancelled${tokenQuery}`),
            metadata: {
                invoiceId: invoice.id,
                tenantId: invoice.tenant_id,
                type: 'business_invoice',
            },
        };

        const session = await stripe.checkout.sessions.create(
            sessionOptions,
            stripeConnectId ? { stripeAccount: stripeConnectId } : undefined
        );

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Invoice Session Error:', err);
        return clientErrorResponse(err, { request: req, scope: 'stripe/create-invoice-session' });
    }
}
