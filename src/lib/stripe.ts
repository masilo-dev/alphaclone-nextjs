import Stripe from 'stripe';

let cachedStripe: ReturnType<typeof createStripeClient> | null = null;

function createStripeClient() {
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

function getStripeClient() {
    if (!cachedStripe) {
        cachedStripe = createStripeClient();
    }

    return cachedStripe;
}

export const stripe = new Proxy({} as object, {
    get(_target, prop, receiver) {
        const client = getStripeClient() as any;
        const value = Reflect.get(client, prop, receiver);
        return typeof value === 'function' ? value.bind(client) : value;
    },
}) as ReturnType<typeof createStripeClient>;
