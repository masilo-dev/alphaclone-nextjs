import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || 'development';

Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // Edge runtime has stricter limits
    tracesSampleRate: 0.1,

    // Before sending to Sentry, scrub sensitive data
    beforeSend(event) {
        // Remove sensitive data
        if (event.request?.cookies) {
            delete event.request.cookies;
        }

        if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
        }

        return event;
    },

    // Edge-specific configuration
    initialScope: {
        tags: {
            environment: ENVIRONMENT,
            runtime: 'edge',
        },
    },
});
