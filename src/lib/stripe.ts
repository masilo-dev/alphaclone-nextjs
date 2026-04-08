import Stripe from 'stripe';

let cachedStripe: Stripe | null = null;

function createStripeClient(): Stripe {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY is missing. Stripe server routes are unavailable.');
    }

    return new Stripe(stripeKey, {
        apiVersion: '2023-10-16' as any,
        appInfo: {
            name: 'AlphaClone OS',
            version: '1.0.0',
        },
    });
}

function getStripeClient(): Stripe {
    if (!cachedStripe) {
        cachedStripe = createStripeClient();
    }

    return cachedStripe;
}

export const stripe = new Proxy({} as Stripe, {
    get(_target, prop, receiver) {
        const client = getStripeClient() as any;
        const value = Reflect.get(client, prop, receiver);
        return typeof value === 'function' ? value.bind(client) : value;
    },
}) as Stripe;
