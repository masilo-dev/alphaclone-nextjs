'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { tenantService } from '../services/tenancy/TenantService';
import type { Tenant, SubscriptionPlan } from '../services/tenancy/types';
import { authService } from '../services/authService';
import { User } from '../types';

export interface TenantContextType {
  currentTenant: Tenant | null;
  userTenants: Array<Tenant & { role: string }>;
  isLoading: boolean;
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
  createTenant: (data: CreateTenantData) => Promise<Tenant>;
  getDashboardStats: (tenantId: string, userId: string, forceRefresh?: boolean) => Promise<{ stats: any | null; error: string | null }>;
}

interface CreateTenantData {
  name: string;
  slug: string;
  plan?: SubscriptionPlan;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(() => {
    // Synchronously read from cache so the dashboard renders immediately
    if (typeof window !== 'undefined') {
      return tenantService.getCachedCurrentTenant() || null;
    }
    return null;
  });
  const [userTenants, setUserTenants] = useState<Array<Tenant & { role: string }>>([]);
  // Start as false if we already have a cached tenant — no need to block the UI
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !tenantService.getCachedCurrentTenant();
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const hasResolvedOnceRef = useRef(false);

  // Load user's tenants when user logs in
  useEffect(() => {
    // Subscribe to auth changes
    const { data: { subscription } } = authService.onAuthStateChange((u) => {
      setUser(u);
    });

    // Initial check
    authService.getCurrentUser().then(({ user }) => setUser(user));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* Methods defined before useEffect to avoid 'used before declaration' */
  const switchTenant = useCallback(async (tenantId: string) => {
    const tenant = userTenants.find(t => t.id === tenantId);

    if (!tenant) {
      throw new Error('Tenant not found or no access');
    }

    // Update context
    setCurrentTenant(tenant);

    // Persist to localStorage
    tenantService.setCurrentTenant(tenantId);

    // Reload the page to fetch new tenant's data
    window.location.reload();
  }, [userTenants]);

  const loadUserTenants = useCallback(async function loadUserTenantsImpl(timeoutId?: NodeJS.Timeout, retryCount = 0) {
    if (!user?.id) return;

    try {
      setError(null); // Clear previous errors
      const hasCachedTenant = !!tenantService.getCachedCurrentTenant();
      if (!hasCachedTenant && !hasResolvedOnceRef.current) {
        setIsLoading(true);
      }

      // Get all tenants user belongs to
      const tenants = await tenantService.getUserTenants(user.id);
      setUserTenants(tenants);

      // Clear timeout on successful load
      if (timeoutId) clearTimeout(timeoutId);

      if (tenants.length === 0 && retryCount < 3) {
        // Back-off retry: handles replication lag during rapid post-signup redirects
        const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
        console.log(`[TenantContext] No tenants found (attempt ${retryCount + 1}/3), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return await loadUserTenantsImpl(timeoutId, retryCount + 1);
      }

      if (tenants.length > 0) {
        console.log(`[TenantContext] Successfully loaded ${tenants.length} tenants for user:`, user.id);
        // Try to load saved tenant from localStorage
        const savedTenantId = tenantService.getCurrentTenantId();

        // Verify user still has access to saved tenant
        const savedTenant = tenants.find(t => t.id === savedTenantId);

        if (savedTenant) {
          console.log('[TenantContext] Using saved tenant:', savedTenant.id);
          setCurrentTenant(savedTenant);
          // Refresh the full object cache
          tenantService.setCurrentTenant(savedTenant);
          hasResolvedOnceRef.current = true;
          setIsLoading(false);
        } else {
          // Default to first tenant
          const firstTenant = tenants[0];
          console.log('[TenantContext] No saved tenant valid, defaulting to:', firstTenant.id);
          setCurrentTenant(firstTenant);
          tenantService.setCurrentTenant(firstTenant);
          hasResolvedOnceRef.current = true;
          setIsLoading(false);
        }
      } else {
        // Any user with no tenants gets a default org auto-created
        console.log(`[TenantContext] No tenants found for user with role ${user.role}, auto-creating...`);

        try {
          // Generate tenant name based on role
          // Super admin gets "ALPHACLONE SYSTEMS" as default organization
          const tenantName = user.role === 'admin'
            ? 'ALPHACLONE SYSTEMS'
            : `${user.name || user.email?.split('@')[0] || 'User'}'s Organization`;
          const tenantSlug = user.role === 'admin'
            ? 'alphaclone-systems'
            : `org-${user.id.substring(0, 8)}`;

          const newTenant = await tenantService.createTenant({
            name: tenantName,
            slug: tenantSlug,
            adminUserId: user.id,
            plan: 'free'
          });

          console.log('Default tenant created:', newTenant.id);

          // Set as current tenant
          setCurrentTenant(newTenant);
          setUserTenants([{ ...newTenant, role: 'tenant_admin' }]);
          tenantService.setCurrentTenant(newTenant.id);
          if (timeoutId) clearTimeout(timeoutId);
          hasResolvedOnceRef.current = true;
          setIsLoading(false);
        } catch (error: any) {
          console.error('Failed to auto-create default tenant:', error);
          console.error('Auto-create error details:', {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint
          });

          // Handle specific function overload error
          let errorMessage = 'Unable to create your organization. Please contact support.';
          if (error?.code === 'PGRST203') {
            errorMessage = 'Database function conflict detected. Please refresh the page and try again.';
          } else if (error?.message?.includes('Failed to fetch')) {
            errorMessage = 'Network connection unstable. Please check your internet connection and try again.';
          }

          // CRITICAL: Set loading to false and error immediately
          setCurrentTenant(null);
          setUserTenants([]);
          tenantService.clearCurrentTenant();
          setError(errorMessage);
          if (timeoutId) clearTimeout(timeoutId);
          hasResolvedOnceRef.current = true;
          setIsLoading(false);

          // Early return to prevent further execution
          return;
        }
      }
    } catch (error: any) {
      console.error('Failed to load user tenants:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      // Handle specific network errors
      const isNetworkError = error?.message?.includes('Failed to fetch') || 
                           error?.message?.includes('ERR_NETWORK_CHANGED') ||
                           error?.message?.includes('ERR_FAILED') ||
                           error?.code === 'NETWORK_ERROR';

      // CRITICAL: Set error and stop loading immediately
      let errorMessage = error?.message || 'Failed to load tenants';
      
      if (isNetworkError) {
        errorMessage = 'Network connection unstable. Please check your internet connection and refresh.';
      } else if (error?.code === 'PGRST301' || error?.message?.includes('403')) {
        errorMessage = 'Permission denied. Please contact support.';
      } else if (error?.code === 'PGRST203') {
        errorMessage = 'Database function conflict. Please refresh the page.';
      }

      setError(errorMessage);
      // Keep cached tenant visible during transient failures so the UI stays clickable.
      if (!tenantService.getCachedCurrentTenant()) {
        setCurrentTenant(null);
        setUserTenants([]);
      }
      if (timeoutId) clearTimeout(timeoutId);
      hasResolvedOnceRef.current = true;
      setIsLoading(false);

      // For network errors, retry after a delay
      if (isNetworkError && !timeoutId) {
        console.log('[TenantContext] Network error detected, scheduling retry...');
        setTimeout(() => {
          if (user?.id) {
            console.log('[TenantContext] Retrying tenant load after network error...');
            loadUserTenants();
          }
        }, 3000); // Retry after 3 seconds
      }
    }
  }, [user?.id]);

  const refreshTenants = useCallback(async () => {
    if (user?.id) {
      await loadUserTenants();
    }
  }, [user?.id, loadUserTenants]);

  const createTenant = useCallback(async (data: CreateTenantData): Promise<Tenant> => {
    if (!user?.id) {
      throw new Error('Must be logged in to create tenant');
    }

    const tenant = await tenantService.createTenant({
      name: data.name,
      slug: data.slug,
      adminUserId: user.id,
      plan: data.plan || 'free'
    });

    // Refresh tenant list
    await refreshTenants();

    // Switch to new tenant
    await switchTenant(tenant.id);

    return tenant;
  }, [user, refreshTenants, switchTenant]);

  const getDashboardStats = useCallback(async (tenantId: string, userId?: string, forceRefresh = false) => {
    if (!tenantId) {
      console.warn('[TenantContext] getDashboardStats called with missing tenantId');
      return { stats: null, error: 'Missing tenantId' };
    }
    
    if (!userId) {
      console.warn('[TenantContext] getDashboardStats called with missing userId');
      return { stats: null, error: 'Missing userId' };
    }
    
    try {
      // tenantService.getDashboardStats already returns { stats, error }
      const result = await tenantService.getDashboardStats(tenantId, userId, forceRefresh);
      return result; // pass through directly — do NOT double-wrap
    } catch (error) {
      console.error('[TenantContext] getDashboardStats failed:', error);
      return { stats: null, error: 'Failed to fetch stats' };
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      // Timeout safeguard: Force loading to false after 20 seconds to allow Vercel cold starts
      const timeoutId = setTimeout(() => {
        setIsLoading((current) => {
          if (current) {
            console.warn('TenantContext: Loading timeout reached, forcing isLoading to false');
            setError('Loading workspace data took too long. Please refresh the page.');
            return false;
          }
          return current;
        });
      }, 20000); // Increased from 10 to 20 seconds

      loadUserTenants(timeoutId);

      return () => clearTimeout(timeoutId);
    } else {
      hasResolvedOnceRef.current = false;
      setCurrentTenant(null);
      setUserTenants([]);
      setIsLoading(false);
      setError(null);
    }
  }, [user?.id, loadUserTenants]);



  const value = useMemo(() => ({
    currentTenant,
    userTenants,
    isLoading,
    error,
    switchTenant,
    refreshTenants,
    createTenant,
    getDashboardStats
  }), [
    currentTenant,
    userTenants,
    isLoading,
    error,
    switchTenant,
    refreshTenants,
    createTenant,
    getDashboardStats
  ]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);

  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }

  return context;
}

// Helper hook to get current tenant ID (throws if no tenant)
export function useCurrentTenantId(): string {
  const { currentTenant } = useTenant();

  if (!currentTenant) {
    throw new Error('No active tenant. User must create or join a tenant.');
  }

  return currentTenant.id;
}

// Helper hook to check if user has specific role in current tenant
export function useTenantRole(): string | null {
  const { currentTenant, userTenants } = useTenant();

  if (!currentTenant) return null;

  const tenant = userTenants.find(t => t.id === currentTenant.id);
  return tenant?.role || null;
}
