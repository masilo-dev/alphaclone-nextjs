// Global error handlers for network and chunk loading issues

/**
 * Handle ChunkLoadError globally
 */
export function setupGlobalErrorHandlers() {
  // Handle unhandled chunk loading errors
  const handleChunkLoadError = (event: ErrorEvent) => {
    if (event.error?.name === 'ChunkLoadError' || event.message?.includes('Loading chunk')) {
      const reloadKey = 'ac_chunk_reload_ts';
      const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
      const now = Date.now();
      if (now - lastReload < 15000) {
        console.warn('[GlobalErrorHandler] ChunkLoadError suppressed — reload already attempted recently');
        return;
      }
      sessionStorage.setItem(reloadKey, String(now));
      console.log('[GlobalErrorHandler] ChunkLoadError detected, clearing cache and reloading...');
      
      // Clear service worker cache if available
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }).then(() => {
          console.log('[GlobalErrorHandler] Cache cleared, reloading...');
          window.location.reload();
        }).catch(err => {
          console.error('[GlobalErrorHandler] Failed to clear cache:', err);
          globalThis.location.reload();
        });
      } else {
        // Fallback: just reload
        globalThis.location.reload();
      }
    }
  };

  // Handle unhandled promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason;
    
    if (error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk')) {
      console.log('[GlobalErrorHandler] ChunkLoadError in promise rejection, reloading...');
      handleChunkLoadError({ error, message: error.message } as ErrorEvent);
    } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_NETWORK_CHANGED')) {
      console.log('[GlobalErrorHandler] Network error detected:', error.message);
      // Don't reload for network errors, just log them
      event.preventDefault(); // Prevent default browser error handling
    }
  };

  // Register error handlers
  window.addEventListener('error', handleChunkLoadError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Return cleanup function
  return () => {
    window.removeEventListener('error', handleChunkLoadError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}

/**
 * Check if the error is network-related
 */
export function isNetworkError(error: any): boolean {
  return error?.message?.includes('Failed to fetch') || 
         error?.message?.includes('ERR_NETWORK_CHANGED') ||
         error?.message?.includes('ERR_FAILED') ||
         error?.code === 'NETWORK_ERROR' ||
         error?.name === 'TypeError' && error?.message?.includes('Failed to fetch');
}

/**
 * Check if the error is a chunk loading error
 */
export function isChunkLoadError(error: any): boolean {
  return error?.name === 'ChunkLoadError' || 
         error?.message?.includes('Loading chunk') ||
         error?.message?.includes('chunk load');
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: any): string {
  if (isChunkLoadError(error)) {
    return 'Application update available. Reloading...';
  }
  
  if (isNetworkError(error)) {
    return 'Network connection unstable. Please check your internet connection.';
  }
  
  if (error?.code === 'PGRST203') {
    return 'Database function conflict. Please refresh the page.';
  }
  
  if (error?.code === 'PGRST301' || error?.message?.includes('403')) {
    return 'Permission denied. Please contact support.';
  }
  
  return error?.message || 'An unexpected error occurred';
}

/**
 * Retry mechanism for failed operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;

  const getErrorCode = (error: unknown): string | undefined => {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === 'string' ? code : undefined;
    }

    return undefined;
  };
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      const errorCode = getErrorCode(error);
      if (errorCode === 'PGRST203' || errorCode === 'PGRST301') {
        throw error;
      }
      
      // If it's the last retry, throw the error
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Wait before retrying
      console.log(`[Retry] Operation failed, retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError;
}
