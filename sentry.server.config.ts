import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || 'development';

Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // Server-side performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Integrations
    integrations: [
        // Automatically instrument Node.js libraries
        ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],

    // Before sending to Sentry, scrub sensitive data
    beforeSend(event, hint) {
        // Remove PII (Personally Identifiable Information)
        if (event.request) {
            // Remove cookies
            delete event.request.cookies;

            // Remove sensitive headers
            if (event.request.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
                delete event.request.headers['x-api-key'];
            }

            // Redact sensitive query parameters
            if (event.request.query_string) {
                const sensitiveParams = ['token', 'api_key', 'password', 'secret'];
                sensitiveParams.forEach(param => {
                    if (event.request?.query_string) {
                        event.request.query_string = event.request.query_string.replace(
                            new RegExp(`${param}=[^&]*`, 'gi'),
                            `${param}=[REDACTED]`
                        );
                    }
                });
            }
        }

        // Scrub sensitive data from error messages
        if (event.exception?.values) {
            event.exception.values.forEach(exception => {
                if (exception.value) {
                    // Redact potential tokens/keys in error messages
                    exception.value = exception.value.replace(
                        /([a-zA-Z0-9_-]{32,})/g,
                        '[REDACTED_TOKEN]'
                    );
                }
            });
        }

        return event;
    },

    // Ignore specific errors
    ignoreErrors: [
        // Database connection timeouts (usually temporary)
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',

        // Supabase expected errors
        'JWT expired',
        'Invalid token',

        // Next.js expected errors
        'NEXT_NOT_FOUND',
    ],

    // Enable debugging in development
    debug: ENVIRONMENT === 'development',

    // Add default tags
    initialScope: {
        tags: {
            environment: ENVIRONMENT,
            runtime: 'node',
        },
    },
});

// Helper function to capture exceptions with context
export function captureServerError(
    error: Error,
    context?: {
        userId?: string;
        tenantId?: string;
        endpoint?: string;
        metadata?: Record<string, any>;
    }
) {
    Sentry.captureException(error, {
        tags: {
            endpoint: context?.endpoint,
        },
        user: context?.userId
            ? {
                  id: context.userId,
              }
            : undefined,
        contexts: {
            tenant: context?.tenantId
                ? {
                      tenant_id: context.tenantId,
                  }
                : undefined,
            custom: context?.metadata,
        },
    });
}

// Helper to capture API route errors
export function captureAPIError(
    error: Error,
    request: Request,
    additionalContext?: Record<string, any>
) {
    Sentry.captureException(error, {
        tags: {
            endpoint: request.url,
            method: request.method,
        },
        contexts: {
            request: {
                url: request.url,
                method: request.method,
            },
            custom: additionalContext,
        },
    });
}
