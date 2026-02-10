import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development';

Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // Adjust sample rate for performance monitoring
    // 1.0 = 100% of transactions sent to Sentry
    // Lower in production to reduce costs
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Integrations - using defaults for maximum compatibility
    // Custom integrations can be added when needed

    // Before sending to Sentry, scrub sensitive data
    beforeSend(event, hint) {
        // Remove sensitive data from error context
        if (event.request?.cookies) {
            delete event.request.cookies;
        }

        if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
        }

        // Filter out known non-critical errors
        if (event.exception?.values) {
            const errorMessage = event.exception.values[0]?.value || '';

            // Ignore specific errors
            const ignoredErrors = [
                'ResizeObserver loop limit exceeded',
                'Non-Error promise rejection captured',
                'cancelled', // React Query cancellations
            ];

            if (ignoredErrors.some(msg => errorMessage.includes(msg))) {
                return null; // Don't send to Sentry
            }
        }

        return event;
    },

    // Ignore specific errors by type
    ignoreErrors: [
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,

        // Network errors (usually user connectivity issues)
        'NetworkError',
        'Failed to fetch',
        'Network request failed',
        'Load failed',

        // User cancellations
        'AbortError',
        'The operation was aborted',
    ],

    // Debugging (only in development)
    debug: ENVIRONMENT === 'development',

    // Attach user context automatically
    // Will be populated by your auth system
    initialScope: {
        tags: {
            environment: ENVIRONMENT,
        },
    },
});

// Custom error boundary for React errors
export function logError(error: Error, errorInfo?: any) {
    Sentry.captureException(error, {
        contexts: {
            react: {
                componentStack: errorInfo?.componentStack,
            },
        },
    });
}
