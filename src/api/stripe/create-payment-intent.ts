import Stripe from 'stripe';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { configureCors } from '../_utils/cors';
import { rateLimit } from '../_utils/rateLimit';
import { validateRequest, stripePaymentSchema } from '../_utils/validation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
} as any);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configure CORS
    const isPreflightHandled = configureCors(req, res);
    if (isPreflightHandled) return;

    // Rate limiting
    const rateLimitResult = rateLimit(req, { maxRequests: 30, windowMs: 15 * 60 * 1000 });
    if (!rateLimitResult.allowed) {
        return res.status(429).json({
            error: 'Too many requests',
            resetAt: rateLimitResult.resetAt
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate request body
    const validation = validateRequest(stripePaymentSchema, req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error });
    }

    const { invoiceId, amount, currency } = validation.data;

    try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: currency,
            metadata: {
                invoiceId: invoiceId,
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error: any) {
        console.error('Stripe error:', error);
        return res.status(500).json({ error: error.message });
    }
}
