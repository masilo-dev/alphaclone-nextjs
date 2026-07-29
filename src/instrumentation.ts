<<<<<<< HEAD
=======
import * as Sentry from '@sentry/nextjs';

>>>>>>> origin/main
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }
}

<<<<<<< HEAD
export async function onRequestError(...args: any[]) {
    const Sentry = await import('@sentry/nextjs');
    return Sentry.captureRequestError(...args);
}
=======
export const onRequestError = Sentry.captureRequestError;
>>>>>>> origin/main
