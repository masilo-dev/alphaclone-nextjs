import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { tenantId, adminEmail, successUrl, cancelUrl } = await req.json();

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        // Hardcoded price for AI Top-up (100 Requests) - $10
        const PRICE_ID = 'price_1T0PTPCCIq5cPz4Ha6rcmFXg';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: 'payment', // One-time payment
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            customer_email: adminEmail,
            success_url: successUrl || `${req.headers.get('origin')}/dashboard?topup=success`,
            cancel_url: cancelUrl || `${req.headers.get('origin')}/dashboard?topup=cancelled`,
            metadata: {
                tenantId,
                type: 'ai_topup',
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Top-up Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
