import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_build';

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️ STRIPE_SECRET_KEY is missing. Stripe functionality will not work.');
}

export const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16' as any,
    appInfo: {
        name: 'AlphaClone OS',
        version: '1.0.0',
    },
});
