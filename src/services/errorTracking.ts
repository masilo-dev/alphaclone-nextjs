import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

/**
 * Initialize Sentry for error tracking and performance monitoring
 * Only initializes in production or when VITE_SENTRY_DSN is provided
 */
export const initErrorTracking = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE;
  const isProduction = environment === 'production';

  // Only initialize if DSN is provided
  if (!dsn) {
    if (isProduction) {
      console.warn('[Sentry] DSN not configured. Error tracking disabled.');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      integrations: [
        new BrowserTracing({
          // Set tracing origins
          tracingOrigins: [
            'localhost',
            /^https:\/\/.*\.alphaclone\.tech/,
            /^https:\/\/.*\.vercel\.app/,
            /^https:\/\/.*\.supabase\.co/,
          ],
          // Performance monitoring
          beforeNavigate(context) {
            return context;
          },
        }),
      ],

      // Performance Monitoring
      tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in prod, 100% in dev

      // Session Replay (optional - requires Sentry plan)
      replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0,

      // Release tracking
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',

      // Filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive information
        if (event.user) {
          // Keep user ID but remove email in production
          if (isProduction) {
            delete event.user.email;
          }
        }

        // Filter out known non-critical errors
        if (event.exception) {
          const error = hint.originalException;
          if (error instanceof Error) {
            // Ignore network errors that are expected
            if (error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError')) {
              return null; // Don't send to Sentry
            }
          }
        }

        return event;
      },

      // Ignore specific errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        'atomicFindClose',
        // Network errors that are expected
        'NetworkError',
        'Failed to fetch',
        // Third-party scripts
        'fb_xd_fragment',
        'bmi_SafeAddOnload',
        'EBCallBackMessageReceived',
      ],

      // Set user context
      initialScope: {
        tags: {
          component: 'frontend',
        },
      },
    });

    console.log('[Sentry] Error tracking initialized');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
};

/**
 * Set user context for error tracking
 */
export const setUserContext = (user: { id: string; email?: string; name?: string; role?: string }) => {
  const sentryUser: any = {
    id: user.id,
  };
  if (user.email) sentryUser.email = user.email;
  if (user.name) sentryUser.username = user.name;
  if (user.role) sentryUser.role = user.role;
  Sentry.setUser(sentryUser);
};

/**
 * Clear user context (on logout)
 */
export const clearUserContext = () => {
  Sentry.setUser(null);
};

/**
 * Capture exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach((key) => {
        scope.setContext(key, context[key]);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
};

/**
 * Capture message manually
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (message: string, category?: string, level?: Sentry.SeverityLevel, data?: Record<string, any>) => {
  const breadcrumb: any = {
    message,
    category: category || 'default',
    level: level || 'info',
    timestamp: Date.now() / 1000,
  };
  if (data) breadcrumb.data = data;
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Set additional context
 */
export const setContext = (key: string, context: Record<string, any>) => {
  Sentry.setContext(key, context);
};

/**
 * Set tag for filtering
 */
export const setTag = (key: string, value: string) => {
  Sentry.setTag(key, value);
};

