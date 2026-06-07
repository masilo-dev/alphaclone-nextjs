import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const { invoiceId, publicToken, successUrl, cancelUrl } = await req.json();

        if (!invoiceId) {
            return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
        }

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

        if (!user && !isPublicAccess) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (invoice.status === 'paid') {
            return NextResponse.json({ error: 'Invoice already paid' }, { status: 409 });
        }

        const { data: tenantData } = await supabaseAdmin
            .from('tenants')
            .select('stripe_connect_id, stripe_connect_onboarded')
            .eq('id', invoice.tenant_id)
            .single();

        const stripeConnectId = (tenantData?.stripe_connect_onboarded && tenantData?.stripe_connect_id)
            ? tenantData.stripe_connect_id
            : null;

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
        const tokenQuery = publicToken ? `&token=${publicToken}` : '';

        const sessionOptions: any = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
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
            success_url: successUrl || `${origin}/invoice/${invoiceId}?payment=success${tokenQuery}`,
            cancel_url: cancelUrl || `${origin}/invoice/${invoiceId}?payment=cancelled${tokenQuery}`,
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
