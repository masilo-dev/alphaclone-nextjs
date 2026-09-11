// import * as Sentry from '@sentry/react';
// import { BrowserTracing } from '@sentry/tracing';

/**
 * Error tracking disabled - Sentry not installed
 * Placeholder implementations to prevent build errors
 */
export const initErrorTracking = () => {
  console.log('[Error Tracking] Sentry not configured');
};

export const setUserContext = (user: { id: string; email?: string; name?: string; role?: string }) => {
  // No-op
};

export const clearUserContext = () => {
  // No-op
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  console.error('[Error]', error, context);
};

export const captureMessage = (message: string, level: string = 'info') => {
  console.log(`[${level}]`, message);
};

export const addBreadcrumb = (message: string, category?: string, level?: string, data?: Record<string, any>) => {
  // No-op
};

export const setContext = (key: string, context: Record<string, any>) => {
  // No-op
};

export const setTag = (key: string, value: string) => {
  // No-op
};
