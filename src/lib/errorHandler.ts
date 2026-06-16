/**
 * Centralized error handler for the business dashboard.
 * Provides consistent error handling, logging, and user feedback.
 */

import toast from 'react-hot-toast';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ErrorContext {
  component: string;
  action: string;
  severity: ErrorSeverity;
  userId?: string;
  tenantId?: string;
}

export interface ErrorResult {
  userMessage: string;
  shouldRetry: boolean;
  retryDelay?: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  'Failed to fetch': 'Network connection lost. Please check your internet and try again.',
  'NetworkError': 'Unable to reach our servers. Please try again in a few moments.',
  'AbortError': 'Request was cancelled. Please try again.',
  'Timeout': 'Request timed out. Please try again.',
  '403': 'You don\'t have permission to perform this action.',
  '404': 'The requested resource was not found.',
  '429': 'Too many requests. Please wait a moment and try again.',
  '500': 'Server error. Our team has been notified.',
  'PGRST301': 'Permission denied. Please contact support.',
  'PGRST203': 'Database error. Please refresh the page.',
};

export function handleError(error: unknown, context: ErrorContext): ErrorResult {
  const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
  const errorCode = extractErrorCode(errorMessage);
  
  // Log to console with context
  console.error(`[${context.severity.toUpperCase()}] ${context.component}:${context.action}`, {
    error: errorMessage,
    context,
    timestamp: new Date().toISOString(),
  });

  // Determine user-friendly message
  const userMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[errorMessage] || 
    (context.severity === 'critical' 
      ? 'An unexpected error occurred. Please refresh the page.'
      : 'Something went wrong. Please try again.');

  // Show toast for non-critical errors
  if (context.severity !== 'critical') {
    toast.error(userMessage, {
      duration: 5000,
      id: `${context.component}-${context.action}`,
    });
  }

  // Determine retry strategy
  const shouldRetry = context.severity !== 'critical' && !isPermanentError(errorCode);
  const retryDelay = shouldRetry ? getRetryDelay(errorCode) : undefined;

  return { userMessage, shouldRetry, retryDelay };
}

function extractErrorCode(errorMessage: string): string {
  // Try to extract HTTP status code
  const statusMatch = errorMessage.match(/\b(\d{3})\b/);
  if (statusMatch) return statusMatch[1];

  // Try to extract known error patterns
  const knownErrors = Object.keys(ERROR_MESSAGES);
  for (const pattern of knownErrors) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return pattern;
    }
  }

  return errorMessage;
}

function isPermanentError(errorCode: string): boolean {
  const permanentCodes = ['403', '404', 'PGRST301', 'PGRST203'];
  return permanentCodes.includes(errorCode);
}

function getRetryDelay(errorCode: string): number {
  if (errorCode === '429') return 5000; // 5 seconds for rate limiting
  if (errorCode === 'Timeout') return 3000; // 3 seconds for timeout
  return 2000; // 2 seconds default
}

/**
 * Wrapper for async operations with automatic error handling.
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  fallbackValue: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const result = handleError(error, context);
    
    if (result.shouldRetry && result.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, result.retryDelay));
      try {
        return await operation();
      } catch (retryError) {
        handleError(retryError, { ...context, severity: 'high' });
        return fallbackValue;
      }
    }
    
    return fallbackValue;
  }
}

/**
 * Creates a debounced search function.
 */
export function createDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
): (query: string) => Promise<T[]> {
  let timeoutId: NodeJS.Timeout;
  let pendingQuery: string | null = null;

  return (query: string): Promise<T[]> => {
    return new Promise((resolve) => {
      pendingQuery = query;
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        if (pendingQuery === query) {
          try {
            const results = await searchFn(query);
            resolve(results);
          } catch {
            resolve([]);
          }
        }
      }, delay);
    });
  };
}
