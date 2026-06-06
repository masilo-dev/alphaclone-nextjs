import * as Sentry from '@sentry/nextjs';
import { initBotId } from 'botid/client/core';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development';

// 1. Initialize Sentry
Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    beforeSend(event: any, hint: any) {
        if (event.request?.cookies) {
            delete event.request.cookies;
        }

        if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
        }

        if (event.exception?.values) {
            const errorMessage = event.exception.values[0]?.value || '';
            const ignoredErrors = [
                'ResizeObserver loop limit exceeded',
                'Non-Error promise rejection captured',
                'cancelled',
                'e.unsubscribe is not a function',
                'unsubscribe is not a function',
            ];

            if (ignoredErrors.some(msg => errorMessage.includes(msg))) {
                return null;
            }
        }

        return event;
    },
    ignoreErrors: [
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
        'NetworkError',
        'Failed to fetch',
        'Network request failed',
        'Load failed',
        'AbortError',
        'The operation was aborted',
        /unsubscribe is not a function/i,
        /ERR_BLOCKED_BY_CLIENT/i,
    ],
    debug: ENVIRONMENT === 'development',
    initialScope: {
        tags: {
            environment: ENVIRONMENT,
        },
    },
});

// 2. Initialize BotID
initBotId({
  protect: [
    {
      path: '/api/scraper/search',
      method: 'POST',
    },
    {
      path: '/api/onboarding/*',
      method: 'POST',
    }
  ],
});

export function logError(error: Error, errorInfo?: any) {
    Sentry.captureException(error, {
        contexts: {
            react: {
                componentStack: errorInfo?.componentStack,
            },
        },
    });
}

// Required for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
