'use client';

import { useContext } from 'react';
import { TenantContext, TenantContextType } from '@/contexts/TenantContext';

/**
 * Safe hook to use tenant context with fallback for cases where the context might not be available
 * This prevents "useTenant must be used within a TenantProvider" errors during lazy loading or error boundaries
 */
export function useTenantSafe(): TenantContextType | null {
  try {
    const context = useContext(TenantContext);
    return context || null;
  } catch (error) {
    // Context not available (likely during lazy loading or error boundary)
    console.warn('[useTenantSafe] TenantContext not available, returning null');
    return null;
  }
}

/**
 * Hook that returns currentTenant with safe fallback
 */
export function useCurrentTenantSafe() {
  const context = useTenantSafe();
  return context?.currentTenant || null;
}

/**
 * Hook that returns tenant loading state with safe fallback
 */
export function useTenantLoadingSafe() {
  const context = useTenantSafe();
  return context?.isLoading || false;
}
