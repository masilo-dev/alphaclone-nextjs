import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string || '', {
            apiVersion: '2023-10-16' as any,
        });

        const { amount, currency, description, invoiceId } = await req.json();

        if (!amount || !currency) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency, // e.g. 'usd'
            description: description || `Invoice #${invoiceId}`,
            metadata: {
                invoiceId,
                integration: 'alphaclone_payment_service'
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        });

    } catch (error: any) {
        console.error('Stripe error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
